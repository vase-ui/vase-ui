import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

/** A constant that holds class names has a name that ends with one of these words. */
const CLASS_CONSTANT = /Class(?:Name|es)?$/;

// `vue/compiler-sfc` does not export the enum `NodeTypes`, so the code compares its values.
const ATTRIBUTE = 6;
const DIRECTIVE = 7;

interface TemplateNode {
  props?: {
    type: number;
    name: string;
    value?: { content: string } | undefined;
    arg?: { content?: string } | undefined;
    exp?: { content?: string } | undefined;
  }[];
  children?: unknown[];
}

function collectStrings(node: ts.Node, strings: string[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    strings.push(node.text);
  } else if (ts.isTemplateExpression(node)) {
    strings.push(node.head.text);
    for (const span of node.templateSpans) {
      collectStrings(span.expression, strings);
      strings.push(span.literal.text);
    }
  } else {
    ts.forEachChild(node, (child) => {
      collectStrings(child, strings);
    });
  }
}

function isClassKey(name: ts.PropertyName): boolean {
  return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'class';
}

/** The strings with one space between the class names, and with no empty string. */
function normalized(strings: string[]): string[] {
  return strings.map((text) => text.trim().split(/\s+/).join(' ')).filter((text) => text !== '');
}

function readScript(text: string, scriptKind: ts.ScriptKind, classKeys: boolean): string[] {
  const strings: string[] = [];
  const visit = (node: ts.Node): void => {
    const holdsClasses =
      (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'className') ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        CLASS_CONSTANT.test(node.name.text)) ||
      (classKeys && ts.isPropertyAssignment(node) && isClassKey(node.name));
    if (holdsClasses && node.initializer) {
      collectStrings(node.initializer, strings);
    } else {
      ts.forEachChild(node, visit);
    }
  };
  visit(ts.createSourceFile('demo', text, ts.ScriptTarget.Latest, true, scriptKind));
  return normalized(strings);
}

/**
 * The class strings of a file of Base UI: each string in a `className` attribute, and each string
 * in a constant whose name ends with `Class`, `ClassName` or `Classes`.
 */
export function classStringsOfTsx(text: string): string[] {
  return readScript(text, ts.ScriptKind.TSX, false);
}

/**
 * The class strings of a `.ts` file or a script block of a Vue demo: each string in a constant
 * that has such a name, and each string in the value of a `class` key of an object literal. An
 * `h()` call gives a class in that form.
 */
export function classStringsOfScript(text: string): string[] {
  return readScript(text, ts.ScriptKind.TS, true);
}

/**
 * The class strings of a Vue file: each `class` attribute, each string in a `:class` binding, and
 * the class strings of its script blocks.
 */
export function classStringsOfVue(text: string): string[] {
  const { descriptor } = parse(text);
  const strings: string[] = [];
  const visit = (node: TemplateNode): void => {
    for (const prop of node.props ?? []) {
      if (prop.type === ATTRIBUTE && prop.name === 'class' && prop.value) {
        strings.push(prop.value.content);
      } else if (
        prop.type === DIRECTIVE &&
        prop.name === 'bind' &&
        prop.arg?.content === 'class' &&
        prop.exp?.content !== undefined
      ) {
        // The parentheses make an object or an array at the start an expression.
        collectStrings(
          ts.createSourceFile(
            'class.ts',
            `(${prop.exp.content})`,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
          ),
          strings,
        );
      }
    }
    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child !== null) {
        visit(child);
      }
    }
  };
  if (descriptor.template?.ast) {
    visit(descriptor.template.ast);
  }
  const scripts = [descriptor.script, descriptor.scriptSetup].flatMap((block) =>
    block ? classStringsOfScript(block.content) : [],
  );
  return [...normalized(strings), ...scripts];
}
