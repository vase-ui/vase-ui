import ts from 'typescript';
import { toVaseName } from './paths.ts';

export interface CaseRow {
  describe: string[];
  title: string;
  conditions?: string[];
}

export interface SuiteRow {
  describe: string[];
  suite: string;
  conditions?: string[];
}

export type TestRow = CaseRow | SuiteRow;

export function isSuiteRow(row: TestRow): row is SuiteRow {
  return 'suite' in row;
}

export function titlesOf(row: TestRow): string[] {
  return isSuiteRow(row) ? row.describe : [...row.describe, row.title];
}

export function checkTitleNames(
  path: string,
  rows: TestRow[],
  upstreamRows: TestRow[] = [],
): string[] {
  // A title of our own can name the upstream project, as in "rules with no Base UI case".
  const ported = new Set(upstreamRows.flatMap(titlesOf).map((title) => toVaseName(title, 'title')));
  return [...new Set(rows.flatMap(titlesOf))].flatMap((title) => {
    const vaseTitle = toVaseName(title, 'title');
    const name = ported.has(vaseTitle) ? vaseTitle : toVaseName(title);
    return name === title ? [] : [`${path}: use "${name}" for the test title "${title}".`];
  });
}

interface Declaration {
  isBlock: boolean;
  conditions: string[];
}

interface Context {
  describe: string[];
  conditions: string[];
}

const CALLED_MODIFIERS = new Set(['skipIf', 'runIf', 'each', 'for']);
const PLAIN_MODIFIERS = new Set(['skip', 'todo']);
const HOOKS = new Set(['beforeEach', 'afterEach', 'beforeAll', 'afterAll']);
const DECLARATIONS = new Set(['it', 'test', 'describe']);

const ONLY_IS_NOT_ALLOWED = '`.only` is not allowed. Remove it.';

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function rootOf(expression: ts.Expression): ts.Expression {
  let root = expression;
  while (ts.isPropertyAccessExpression(root) || ts.isCallExpression(root)) {
    root = root.expression;
  }
  return root;
}

function isDeclarationName(node: ts.Node): node is ts.Identifier {
  return ts.isIdentifier(node) && DECLARATIONS.has(node.text);
}

export function readTestRows(path: string, text: string): TestRow[] {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const rows: TestRow[] = [];

  function fail(node: ts.Node, reason: string): never {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    throw new Error(`${path}:${line}: ${reason}`);
  }

  function declarationOf(call: ts.CallExpression): Declaration | undefined {
    const conditions: string[] = [];
    let callee: ts.Expression = call.expression;
    for (;;) {
      if (ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression)) {
        const name = callee.expression.name.text;
        if (!CALLED_MODIFIERS.has(name)) {
          return undefined;
        }
        if (name === 'skipIf' || name === 'runIf') {
          const args = callee.arguments.map((arg) => arg.getText(file)).join(', ');
          conditions.unshift(`${name}(${squash(args)})`);
        }
        callee = callee.expression.expression;
      } else if (ts.isPropertyAccessExpression(callee)) {
        const name = callee.name.text;
        if (!PLAIN_MODIFIERS.has(name)) {
          if (isDeclarationName(rootOf(callee.expression))) {
            fail(
              call,
              name === 'only'
                ? ONLY_IS_NOT_ALLOWED
                : `the modifier "${name}" is not supported. Remove it, or teach scripts/parity/cases.ts the form.`,
            );
          }
          return undefined;
        }
        conditions.unshift(name);
        callee = callee.expression;
      } else {
        break;
      }
    }
    if (!isDeclarationName(callee)) {
      return undefined;
    }
    return { isBlock: callee.text === 'describe', conditions };
  }

  function titleOf(argument: ts.Expression | undefined): string {
    if (argument === undefined) {
      return '';
    }
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return argument.text;
    }
    return squash(argument.getText(file));
  }

  function isBlockCallback(fn: ts.Node): boolean {
    return ts.isCallExpression(fn.parent) && declarationOf(fn.parent)?.isBlock === true;
  }

  function visitSuiteCall(call: ts.CallExpression, context: Context): boolean {
    const statement = call.parent;
    const body = statement.parent;
    const isInBlock =
      ts.isExpressionStatement(statement) &&
      ts.isBlock(body) &&
      ts.isFunctionLike(body.parent) &&
      isBlockCallback(body.parent);
    if (!isInBlock) {
      return false;
    }
    let callee = call.expression;
    const own: string[] = [];
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      if (callee.name.text === 'only') {
        fail(call, ONLY_IS_NOT_ALLOWED);
      }
      if (PLAIN_MODIFIERS.has(callee.name.text)) {
        own.push(callee.name.text);
        callee = callee.expression;
      }
    }
    if (!ts.isIdentifier(callee) || HOOKS.has(callee.text)) {
      return false;
    }
    const conditions = [...context.conditions, ...own];
    rows.push({
      describe: context.describe,
      suite: callee.text,
      ...(conditions.length > 0 ? { conditions } : {}),
    });
    return true;
  }

  function visit(node: ts.Node, context: Context): void {
    if (ts.isTaggedTemplateExpression(node) && isDeclarationName(rootOf(node.tag))) {
      fail(node, 'a tagged template table is not supported. Write the table as an array.');
    }
    if (ts.isCallExpression(node)) {
      const found = declarationOf(node);
      if (found) {
        const conditions = [...context.conditions, ...found.conditions];
        if (found.isBlock) {
          const callback = node.arguments.find(
            (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
          );
          if (callback) {
            const describe = [...context.describe, titleOf(node.arguments[0])];
            visit(callback.body, { describe, conditions });
          }
        } else {
          rows.push({
            describe: context.describe,
            title: titleOf(node.arguments[0]),
            ...(conditions.length > 0 ? { conditions } : {}),
          });
        }
        return;
      }
      if (visitSuiteCall(node, context)) {
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, context));
  }

  visit(file, { describe: [], conditions: [] });
  return rows;
}

function operandsOf(node: ts.Expression): ts.Expression[] {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ? [...operandsOf(node.left), ...operandsOf(node.right)]
    : [node];
}

/**
 * The terms of a condition. Each operand of a `||` of a `skipIf` is a term, because each operand
 * skips the case by itself. Each other condition is one term.
 */
export function conditionTerms(condition: string): string[] {
  if (!condition.startsWith('skipIf(')) {
    return [condition];
  }
  const file = ts.createSourceFile('condition.ts', condition, ts.ScriptTarget.Latest);
  const statement = file.statements.at(0);
  const call = statement && ts.isExpressionStatement(statement) ? statement.expression : undefined;
  const argument = call && ts.isCallExpression(call) ? call.arguments.at(0) : undefined;
  return argument
    ? operandsOf(argument).map((operand) => `skipIf(${operand.getText(file)})`)
    : [condition];
}
