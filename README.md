# https://hqjs.org
Original bebel plugin fork that allows to work with parameter decorators and dependency injection

The plugin is in sync with version `7.9.4` of official plugin, the difference is that Program transformation is done on exit rather then on enter (due to that `jsxPragma` check is done differently as on program exit there is no JSX left when `react` preset is being used), that allows to apply additional transformations to import statements. Plugin has extra option `removeUnusedImports` default to true. When the option is set to false, plugin does not try to remove unused imports that could be suitable for preprocessing templates like `svelte`.

# Installation
```sh
npm install hqjs@babel-plugin-transform-typescript
```
