const assert = require('assert');
const core = require('@babel/core');

module.exports = function transpileEnum(path, t) {
  const { node } = path;

  if (node.declare) {
    path.remove();
    return;
  }

  if (node.const) {
    throw path.buildCodeFrameError('\'const\' enums are not supported.');
  }

  const { name } = node.id;
  const fill = enumFill(path, t, node.id);

  switch (path.parent.type) {
    case 'BlockStatement':
    case 'ExportNamedDeclaration':
    case 'Program': {
      path.insertAfter(fill);

      if (seen(path.parentPath)) {
        path.remove();
      } else {
        const isGlobal = t.isProgram(path.parent);
        const variable = t.variableDeclaration(isGlobal ? 'var' : 'let', [ t.variableDeclarator(node.id) ]);
        path.replaceWith(variable);
      }

      break;
    }
    default: throw new Error(`Unexpected enum parent '${path.parent.type}`);
  }

  function seen(parentPath) {
    if (parentPath.isExportDeclaration()) {
      return seen(parentPath.parentPath);
    }

    if (parentPath.getData(name)) {
      return true;
    } else {
      parentPath.setData(name, true);
      return false;
    }
  }
};

const buildEnumWrapper = core.template(`
  (function (ID) {
    ASSIGNMENTS;
  })(ID || (ID = {}));
`);
const buildStringAssignment = core.template(`
  ENUM["NAME"] = VALUE;
`);
const buildNumericAssignment = core.template(`
  ENUM[ENUM["NAME"] = VALUE] = "NAME";
`);

const buildEnumMember = (isString, options) => (isString ? buildStringAssignment : buildNumericAssignment)(options);

function enumFill(path, t, id) {
  const x = translateEnumValues(path, t);
  const assignments = x.map(([ memberName, memberValue ]) => buildEnumMember(t.isStringLiteral(memberValue), {
    ENUM: t.cloneNode(id),
    NAME: memberName,
    VALUE: memberValue,
  }));
  return buildEnumWrapper({
    ASSIGNMENTS: assignments,
    ID: t.cloneNode(id),
  });
}

function translateEnumValues(path, t) {
  const seen = Object.create(null);
  let prev = -1;
  return path.node.members.map(member => {
    const name = t.isIdentifier(member.id) ? member.id.name : member.id.value;
    const { initializer } = member;
    let value;

    if (initializer) {
      const constValue = initializer.type === 'StringLiteral' ? initializer.value : evalConstant(initializer, seen);

      if (constValue !== undefined) {
        seen[name] = constValue;

        if (typeof constValue === 'number') {
          value = t.numericLiteral(constValue);
          prev = constValue;
        } else {
          assert(typeof constValue === 'string');
          value = t.stringLiteral(constValue);
          prev = undefined;
        }
      } else {
        value = initializer;
        prev = undefined;
      }
    } else if (prev !== undefined) {
      prev++;
      value = t.numericLiteral(prev);
      seen[name] = prev;
    } else {
      throw path.buildCodeFrameError('Enum member must have initializer.');
    }

    return [ name, value ];
  });
}

function evalConstant(expr, seen) {
  switch (expr.type) {
    case 'UnaryExpression': return evalUnaryExpression(expr);
    case 'BinaryExpression': return evalBinaryExpression(expr);
    case 'NumericLiteral': return expr.value;
    case 'ParenthesizedExpression': return evalConstant(expr.expression);
    case 'Identifier': return seen[expr.name];
    default: return undefined;
  }
}

function evalUnaryExpression({
  argument,
  operator,
}) {
  const value = evalConstant(argument);
  if (value === undefined) return undefined;

  switch (operator) {
    case '+': return value;
    case '-': return -value;
    case '~': return ~value;
    default: return undefined;
  }
}

function evalBinaryExpression(expr) {
  const left = evalConstant(expr.left);
  if (left === undefined) return undefined;

  const right = evalConstant(expr.right);
  if (right === undefined) return undefined;

  switch (expr.operator) {
    case '|': return left | right;
    case '&': return left & right;
    case '>>': return left >> right;
    case '>>>': return left >>> right;
    case '<<': return left << right;
    case '^': return left ^ right;
    case '*': return left * right;
    case '/': return left / right;
    case '+': return left + right;
    case '-': return left - right;
    case '%': return left % right;
    default: return undefined;
  }
}
