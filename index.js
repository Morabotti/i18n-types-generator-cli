#!/usr/bin/env node

const yargs = require('yargs');
const fs = require('fs/promises');
const path = require('path');
const glob = require('glob');

const keySuffix = 'Keys';
const singleMap = 'Map';
const multiMap = 'NSMap';

const options = yargs
 .usage('Usage: -p <path>')
 .option('p', {
    alias: 'path',
    describe: 'Path to translations',
    type: 'string',
    demandOption: true
  })
  .option('o', {
    alias: 'output',
    describe: 'Path to output file',
    type: 'string',
    demandOption: true
   })
   .option('l', {
    alias: 'lang',
    describe: 'Default language',
    type: 'string'
   })
   .option('d', {
    alias: 'delimiter',
    describe: 'Namespace delimiter in types',
    type: 'string',
    default: ':'
   })
   .argv;

(async () => {
  const content = await getContents(options);
  const fileContents = await getFileContents(content.files);
  const typeFile = await createTypeFile(content.languages, fileContents);

  const writeFile = path.join(process.cwd(), options.output);
  try {
    fs.writeFile(writeFile, typeFile);
  }
  catch (e) {
    throw new Error(`Could not write file: ${writeFile}\n${e}`)
  }
})()


async function createTypeFile(languages, fileContents) {
  const namespaces = Object.keys(fileContents);
  let file = ``;

  file += `${staticHeader}\n`;
  if (languages.length !== 0) {
    file += `${await createLanguageEnum(languages)}\n`;
  }
  file += `${await createNamespaceEnum(namespaces)}\n`;
  file += `${createKeyTypes(fileContents)}\n`;
  file += `${createMap(singleMap, fileContents, false)}\n`;
  file += `${createMap(multiMap, fileContents, true)}\n`;
  file += `${staticTypes(singleMap, multiMap)}\n`;
  file += `${staticSingleMapping}\n`;
  file += `${staticMultipleMapping}\n`;

  return file;
}

function createMap(mapName, fileContents, includeKey) {
  let map = `interface ${mapName} {\n`;
  for (const [key, value] of Object.entries(fileContents)) {
    const namespace = convertToPascal(key);
    map += `  [Namespace.${namespace}]: ${includeKey
      ? `\`${key}${options.delimiter}$\{${namespace}${keySuffix}}\``
      : `${namespace}${keySuffix}`};\n`;
  }
  map += '}\n';
  return map;
}

function createKeyTypes(fileContents) {
  let types = ``;
  let typeNames = [];

  for (const [key, value] of Object.entries(fileContents)) {
    const typeName = `${convertToPascal(key)}${keySuffix}`;
    typeNames.push(typeName);
    types += `export type ${typeName} = ${value.map(i => `'${i}'`).join(' | ')};\n`;
  }
  types += `\nexport type TranslationKey = ${typeNames.map(i => `${i}`).join(' | ')};\n`;
  return types;
}

function createNamespaceEnum(namespaces) {
  return createEnum(
    'Namespace',
    namespaces.map(ns => [convertToPascal(ns), ns]),
    true
  );
}

function createLanguageEnum(languages) {
  return createEnum(
    'Language',
    languages.map(lang => [convertToPascal(lang), lang]),
    true
  );
}

function createEnum(enumName, rows, exported = false) {
  let enumText = exported ? `export enum ${enumName} {\n` : `enum ${enumName} {\n`;
  for (const [i, row] of rows.entries()) {
    enumText += `  ${row[0]} = '${row[1]}'${i !== rows.length - 1 ? ',' : ''}\n`;
  }
  enumText += `}\n`;
  return enumText;
}

async function getFileContents(files) {
  let contents = {};

  for (const file of files) {
    const data = await fs.readFile(file.path);
    const json = JSON.parse(data);
    const properties = propertiesToArray(json);

    contents[file.namespace] = properties;
  }

  return contents;
}

async function getContents(opts) {
  const variableRegex = /\{\{.*?\}\}/g;
  const realPath = path.join(process.cwd(), opts.path);
  const matches = opts.path.match(variableRegex);

  if (matches === null || !matches.includes('{{ns}}')) {
    throw new Error('No {{ns}} (namespace) found.');
  }

  const includesLang = matches.includes('{{lang}}');
  let languages = [];
  let defaultLang = null;
  
  if (matches.includes('{{lang}}')) {
    const beforeLang = realPath.substring(0, realPath.indexOf('{{lang}}'));
    const langFolderContents = await fs.readdir(beforeLang, { withFileTypes: true });
    languages = langFolderContents
      .filter(item => item.isDirectory())
      .map(item => item.name);

    defaultLang = opts.lang || languages[0] || null;
  }

  if (includesLang && defaultLang === null) {
    throw new Error('No valid language found.');
  }

  const populateNamespacePath = includesLang
    ? realPath.replace('{{lang}}', defaultLang).replace('{{ns}}', '*')
    : realPath.replace('{{ns}}', '*');
  
  try {
    const namespaceFolder = glob.sync(populateNamespacePath);
    const files = namespaceFolder.map(file => {
      const filename = file.replace(/^.*[\\\/]/, '');
      return {
        path: file,
        namespace: path.parse(filename).name.toLowerCase()
      };
    });

    return {
      languages,
      files
    };
  }
  catch (e) {
    throw new Error(`Failed to read namespaces from "${populateNamespacePath}\n${e}"`);
  }
}

function propertiesToArray(obj) {
  const isObject = val => typeof val === 'object' && !Array.isArray(val);
  const addDelimiter = (a, b) => a ? `${a}.${b}` : b;

  const paths = (obj = {}, head = '') => {
    return Object.entries(obj)
      .reduce((item, [key, value]) => {
        let full = addDelimiter(head, key)
        return isObject(value)
          ? item.concat(paths(value, full))
          : item.concat(full)
      }, []);
  }

  return paths(obj);
}

function capitalizeWord(str) {
  return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
}

function formatPascal(input, separator){
  return input.split(separator).map(capitalizeWord).join('');
}

function convertToPascal(str) {
  let name = capitalizeWord(str);

  if (name.includes('_')) {
    name = formatPascal(name, '_');
  }

  if (name.includes('-')) {
    name = formatPascal(name, '-');
  }

  return name;
}

const staticTypes = (single, multi) => `type PickMap<X extends Namespace> = ${single}[X];
type PickMultiple<X extends Namespace[]> = X extends { length: 1 } ? ${single}[X[0]]
  : X extends { length: 2 } ? ${multi}[X[0]] | ${multi}[X[1]]
  : X extends { length: 3 } ? ${multi}[X[0]] | ${multi}[X[1]] | ${multi}[X[2]]
  : X extends { length: 4 } ? ${multi}[X[0]] | ${multi}[X[1]] | ${multi}[X[2]] | ${multi}[X[3]]
  : X extends { length: 5 } ? ${multi}[X[0]] | ${multi}[X[1]] | ${multi}[X[2]] | ${multi}[X[3]] | ${multi}[X[4]]
  : X extends { length: 6 } ? ${multi}[X[0]] | ${multi}[X[1]] | ${multi}[X[2]] | ${multi}[X[3]] | ${multi}[X[4]] | ${multi}[X[5]]
  : ${multi}[X[0]] | ${multi}[X[1]] | ${multi}[X[2]] | ${multi}[X[3]] | ${multi}[X[4]] | ${multi}[X[5]] | ${multi}[X[6]];
`;

const staticHeader = `// THIS FILE IS AUTOMATICALLY GENERATED BY (i18-types-generator-cli)
// MADE BY https://github.com/Morabotti
`;

const staticSingleMapping = `export type TranslationMapping<X extends Namespace> = PickMap<X>;`;
const staticMultipleMapping = `export type TranslationsMapping<X extends Namespace[]> = PickMultiple<X>;`;