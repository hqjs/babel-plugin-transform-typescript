const Enum = require('./enum');
const core = require('@babel/core');
const helperPluginUtils = require('@babel/helper-plugin-utils');
const pluginSyntaxTypescript = require('@babel/plugin-syntax-typescript');

const REACT7 = 7;

const isInType = nodePath => [
  'TSTypeReference',
  'TSQualifiedName',
  'TSExpressionWithTypeArguments',
  'TSTypeQuery',
].includes(nodePath.parent.type);

const PARSED_PARAMS = new WeakSet;

module.exports = helperPluginUtils.declare((api, { jsxPragma = 'React' }) => {
  api.assertVersion(REACT7);
  return {
    inherits: pluginSyntaxTypescript.default,
    visitor: {
      CallExpression(path) {
        path.node.typeParameters = null;
      },

      Class(path) {
        const { node } = path;
        if (node.typeParameters) node.typeParameters = null;
        if (node.superTypeParameters) node.superTypeParameters = null;
        if (node.implements) node.implements = null;
        path.get('body.body').forEach(child => {
          const childNode = child.node;

          if (core.types.isClassMethod(childNode, { kind: 'constructor' })) {
            const parameterProperties = [];

            for (const param of childNode.params) {
              if (param.type === 'TSParameterProperty' && !PARSED_PARAMS.has(param.parameter)) {
                PARSED_PARAMS.add(param.parameter);
                parameterProperties.push(param.parameter);
              }
            }

            if (parameterProperties.length) {
              const assigns = parameterProperties.map(p => {
                const { name } = core.types.isIdentifier(p) ?
                  p :
                  core.types.isAssignmentPattern(p) && core.types.isIdentifier(p.left) ?
                    p.left :
                    { name: null };

                if (name === null) {
                  throw path.buildCodeFrameError('Parameter properties can not be destructuring patterns.');
                }

                const assign = core.types.assignmentExpression(
                  '=',
                  core.types.memberExpression(
                    core.types.thisExpression(),
                    core.types.identifier(name)
                  ),
                  core.types.identifier(name)
                );

                return core.types.expressionStatement(assign);
              });
              const statements = childNode.body.body;
              const [ first, ...rest ] = statements;

              const startsWithSuperCall = first !== undefined &&
                core.types.isExpressionStatement(first) &&
                core.types.isCallExpression(first.expression) &&
                core.types.isSuper(first.expression.callee);

              childNode.body.body = startsWithSuperCall ?
                [ first, ...assigns, ...rest ] :
                [ ...assigns, ...statements ];
            }
          } else if (child.isClassProperty()) {
            childNode.typeAnnotation = null;

            if (!childNode.value && !childNode.decorators) {
              child.remove();
            }
          }
        });
      },

      ClassDeclaration(path) {
        const { node } = path;

        if (node.declare) {
          path.remove();
        }

        if (node.abstract) node.abstract = null;
      },

      ClassMethod(path) {
        const { node } = path;
        if (node.accessibility) node.accessibility = null;
        if (node.abstract) node.abstract = null;
        if (node.optional) node.optional = null;
      },

      ClassProperty(path) {
        const { node } = path;
        if (node.accessibility) node.accessibility = null;
        if (node.abstract) node.abstract = null;
        if (node.readonly) node.readonly = null;
        if (node.optional) node.optional = null;
        if (node.definite) node.definite = null;
        if (node.typeAnnotation) node.typeAnnotation = null;
      },

      Function({ node }) {
        if (node.typeParameters) node.typeParameters = null;
        if (node.returnType) node.returnType = null;
        const [ p0 ] = node.params;

        if (p0 && core.types.isIdentifier(p0) && p0.name === 'this') {
          node.params.shift();
        }

        node.params = node.params.map(p => p.type === 'TSParameterProperty' ? p.parameter : p);
      },

      Identifier: visitPattern,

      JSXOpeningElement(path) {
        path.node.typeParameters = null;
      },

      NewExpression(path) {
        path.node.typeParameters = null;
      },

      Pattern: visitPattern,

      Program: {
        exit(path, state) {
          state.programPath = path;

          for (const stmt of path.get('body')) {
            if (core.types.isImportDeclaration(stmt)) {
              if (stmt.node.specifiers.length === 0) {
                continue;
              }

              let allElided = true;
              const importsToRemove = [];

              for (const specifier of stmt.node.specifiers) {
                const binding = stmt.scope.getBinding(specifier.local.name);

                if (binding && isImportTypeOnly(binding, state.programPath)) {
                  importsToRemove.push(binding.path);
                } else {
                  allElided = false;
                }
              }

              if (allElided) {
                stmt.remove();
              } else {
                for (const importPath of importsToRemove) {
                  importPath.remove();
                }
              }
            }
          }
        },
      },

      RestElement: visitPattern,

      TSAsExpression(path) {
        let { node } = path;

        do {
          node = node.expression;
        } while (core.types.isTSAsExpression(node));

        path.replaceWith(node);
      },

      TSDeclareFunction(path) {
        path.remove();
      },

      TSDeclareMethod(path) {
        path.remove();
      },

      TSEnumDeclaration(path) {
        Enum(path, core.types);
      },

      TSExportAssignment(path) {
        throw path.buildCodeFrameError(`
        'export =' is not supported by @babel/plugin-transform-typescript
        Please consider using 'export <value>;'.
      `);
      },

      TSImportEqualsDeclaration(path) {
        throw path.buildCodeFrameError(`
        'import =' is not supported by @babel/plugin-transform-typescript
        Please consider using 'import <moduleName> from "<moduleName>"; alongside
        Typescript's --allowSyntheticDefaultImports option.
      `);
      },

      TSIndexSignature(path) {
        path.remove();
      },

      TSInterfaceDeclaration(path) {
        path.remove();
      },

      TSModuleDeclaration(path) {
        if (!path.node.declare && path.node.id.type !== 'StringLiteral') {
          throw path.buildCodeFrameError('Namespaces are not supported.');
        }

        path.remove();
      },

      TSNonNullExpression(path) {
        path.replaceWith(path.node.expression);
      },

      TSTypeAliasDeclaration(path) {
        path.remove();
      },

      TSTypeAssertion(path) {
        path.replaceWith(path.node.expression);
      },

      TaggedTemplateExpression(path) {
        path.node.typeParameters = null;
      },

      VariableDeclaration(path) {
        if (path.node.declare) path.remove();
      },

      VariableDeclarator({ node }) {
        if (node.definite) node.definite = null;
      },
    },
  };

  function visitPattern({ node }) {
    if (node.typeAnnotation) node.typeAnnotation = null;
    if (core.types.isIdentifier(node) && node.optional) node.optional = null;
  }

  function isImportTypeOnly(binding, programPath) {
    for (const path of binding.referencePaths) {
      if (!isInType(path)) {
        return false;
      }
    }

    if (binding.identifier.name !== jsxPragma) {
      return true;
    }

    let sourceFileHasJsx = false;
    programPath.traverse({
      JSXElement() {
        sourceFileHasJsx = true;
      },

      JSXFragment() {
        sourceFileHasJsx = true;
      },

    });
    return !sourceFileHasJsx;
  }
});
