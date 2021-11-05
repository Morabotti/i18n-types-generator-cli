# Typescript type generation for i18n files.
This CLI tool was used to help with type-safety while using i18n translations.
Especially designed for `react-i18next` while using `HttpApi`

## Install
Install as dev dependency:
```
npm install -g @morabotti/i18n-types-generator-cli
```

## Usage
You can run the cli with simple npm script:
```json
"scripts": {
  "i18n": "i18n-types-generator -l en -p \"locales/{{lang}}/{{ns}}.json\" -o \"src/generated/translations.generated.ts\""
},
```

CLI tool accepts following option parameters:
```
Options:
  --help            Show help                       [boolean]
  --version         Show version number             [boolean]
  -p, --path        Path to translations            [string] [required]
  -o, --output      Path to output file             [string] [required]
  -l, --lang        Default language                [string]
```

| Option | Description | Example value | Required/Optional |
| --- | ----------- | ----------- | --- |
| Path | Define path to source files. {{lang}} and {{ns}} are currently required. | locales/{{lang}}/{{ns}}.json | **Required** |
| Output | Path to generated typescript file. This file should be included in version control. | src/generated/translations.generated.ts | **Required** |
| Lang | Default language that has the "most" values. This language will construct the types/enums. | en | Optional |

### Example with `react-i18next` hook
```ts
import { KeyPrefix, useTranslation, UseTranslationResponse } from 'react-i18next';
import { TranslationsMapping, Namespace } from '@generated/translations.generated';

interface ResponseContext<T extends Namespace[]>
  extends Omit<UseTranslationResponse<T, KeyPrefix<T>>, 't'> {
  t: (key: TranslationsMapping<T>, values?: Record<string, string | number>) => string;
}

export const useLanguage = <T extends Namespace[]> (
  namespaces?: T
): ResponseContext<T> => {
  return useTranslation(namespaces) as ResponseContext<T>;
};
```

With this custom hook, you will every single time have strongly typed paths. No more typos.

## Development
Install the bin `npm install -g .` Or use `npm run start` with `npm link`/`npm unlink`
Run with `i18n-types-generator -p "/locales/{{lang}}/{{ns}}.json" -o "/example.generated.ts"` format or simply with `npm run start`

## TODO
* Unit/Type testing for generated file
* Support for different formatting
* Rewrite tool with typescript