# babel-plugin-transform-typescript
Original bebel plugin fork that allows to work with parameter decorators and dependency injection

The plugin is in sync with version 7.5.5 of official plugin, the difference is that Program transformation is done on exit rather then on enter, that allows to apply additional to import statements and it has additional option `removeUnusedImports` default to true. When the option is set to false, plugin does not try to remove unused imports that could be suitable for preprocessing templates like `svelte`.
