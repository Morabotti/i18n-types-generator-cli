#!/usr/bin/env node

const yargs = require('yargs');
const fs = require('fs/promises');
const path = require('path');
const glob = require('glob');

const keySuffix = 'Keys';

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
   .argv;

(async () => {
  const content = await getContents(options);
  const fileContents = await getFileContents(content.files);
  const typeFile = await createTypeFile(content.languages, fileContents);
  
  fs.writeFile(path.join(process.cwd(), options.output), typeFile);
})()


async function createTypeFile(languages, fileContents) {
  const namespaces = Object.keys(fileContents);
  let file = ``;

  file += `${staticHeader}\n`;
  file += `${await createLanguageEnum(languages)}\n`;
  file += `${await createNamespaceEnum(namespaces)}\n`;
  file += `${createKeyTypes(fileContents)}\n`;
  file += `${createNamespaceMap(fileContents)}\n`;
  file += `${staticTypes}\n`;
  file += `${staticSingleMapping}\n`;
  file += `${staticMultipleMapping}\n`;

  return file
}

function createNamespaceMap(fileContents) {
  let map = `interface Map {\n`;
  for (const [key, value] of Object.entries(fileContents)) {
    const namespace = capitalizeWord(key);
    map += `  [Namespace.${namespace}]: ${namespace}${keySuffix};\n`
  }
  map += '}\n'
  return map;
}

function createKeyTypes(fileContents) {
  let types = ``;
  for (const [key, value] of Object.entries(fileContents)) {
    const typeName = `${capitalizeWord(key)}${keySuffix}`;
    types += `export type ${typeName} = ${value.map(i => `'${i}'`).join(' | ')};\n`;
  }
  return types;
}

function createNamespaceEnum(namespaces) {
  return createEnum(
    'Namespace',
    namespaces.map(ns => [capitalizeWord(ns), ns]),
    true
  );
}

function createLanguageEnum(languages) {
  return createEnum(
    'Language',
    languages.map(lang => [capitalizeWord(lang), lang]),
    true
  );
}

function createEnum(enumName, rows, exported = false) {
  let enumText = exported ? `export enum ${enumName} {\n` : `enum ${enumName} {\n`;
  for (const [i, row] of rows.entries()) {
    enumText += `  ${row[0]} = '${row[1]}'${i !== rows.length - 1 ? ',' : ''}\n`
  }
  enumText += `}\n`
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

  if (matches === null || !(matches.includes('{{ns}}') && matches.includes('{{lang}}'))) {
    throw new Error('No {{ns}} (namespace) or {{lang}} (language) found.');
  }
  
  const beforeLang = realPath.substring(0, realPath.indexOf('{{lang}}'));
  const langFolderContents = await fs.readdir(beforeLang, { withFileTypes: true });
  const languages = langFolderContents
    .filter(item => item.isDirectory())
    .map(item => item.name);

  const defaultLang = opts.lang || languages[0] || null;
  if (defaultLang === null) {
    throw new Error('No valid language found.');
  }

  const populateNamespacePath = realPath
    .replace('{{lang}}', defaultLang)
    .replace('{{ns}}', '*');

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

const staticTypes = `type PickMap<X extends Namespace> = Map[X];
type PickMultiple<X extends Namespace[]> = X extends { length: 1 } ? Map[X[0]]
  : X extends { length: 2 } ? Map[X[0]] | Map[X[1]]
  : X extends { length: 3 } ? Map[X[0]] | Map[X[1]] | Map[X[2]]
  : X extends { length: 4 } ? Map[X[0]] | Map[X[1]] | Map[X[2]] | Map[X[3]]
  : X extends { length: 5 } ? Map[X[0]] | Map[X[1]] | Map[X[2]] | Map[X[3]] | Map[X[4]]
  : X extends { length: 6 } ? Map[X[0]] | Map[X[1]] | Map[X[2]] | Map[X[3]] | Map[X[4]] | Map[X[5]]
  : Map[X[0]] | Map[X[1]] | Map[X[2]] | Map[X[3]] | Map[X[4]] | Map[X[5]] | Map[X[6]];
`;

const staticHeader = `// THIS FILE IS AUTOMATICALLY GENERATED BY (i18-types-generator-cli)
// MADE BY https://github.com/Morabotti
`;

const staticSingleMapping = `export type TranslationMapping<X extends Namespace> = PickMap<X>;`;
const staticMultipleMapping = `export type TranslationsMapping<X extends Namespace[]> = PickMultiple<X>;`;