import ts from 'typescript';
import { CLASS_CONSTANT, collapseSpace } from './demoClasses.ts';
import type { DemoFile } from './demoClasses.ts';
import { ATTRIBUTE, DIRECTIVE, ELEMENT, INTERPOLATION, TEXT, readVueFile } from './vueFile.ts';
import type { TemplateNode } from './vueFile.ts';

/** The attributes whose value is text that a person reads or hears. */
const TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'alt',
  'placeholder',
  'title',
]);

export interface VariantDifference {
  /**
   * The first element, text or script token that the two variants do not share. It is `undefined`
   * when the forms are equal.
   */
  form: string | undefined;
  /**
   * The first text that differs. It is `undefined` when the texts are equal, and when the two
   * variants have another number of texts.
   */
  text: string | undefined;
}

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : 1);

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isClassStatement(node: ts.Node): boolean {
  return (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.every(
      ({ name }) => ts.isIdentifier(name) && CLASS_CONSTANT.test(name.text),
    )
  );
}

function isStyleImport(node: ts.Node): boolean {
  return (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    (node.moduleSpecifier.text.endsWith('.module.css') || node.moduleSpecifier.text === 'clsx')
  );
}

function isClassAttribute(node: ts.Node, classKeys: boolean): boolean {
  if (ts.isJsxAttribute(node)) {
    return ts.isIdentifier(node.name) && node.name.text === 'className';
  }
  return (
    classKeys &&
    ts.isPropertyAssignment(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === 'class'
  );
}

function isJsx(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

/**
 * The leaves of the TypeScript tree of a script in the sequence of the source, without what the two
 * variants of a demo may do differently: the class attributes, the class constants, the imports of
 * a style sheet or of `clsx`, the parentheses around JSX, the text of an element and the value of
 * an attribute that is text. `classKeys` makes the `class` key of an object a class attribute.
 */
function scriptTokens(text: string, scriptKind: ts.ScriptKind, classKeys: boolean): string[] {
  const source = ts.createSourceFile('demo', text, ts.ScriptTarget.Latest, true, scriptKind);
  const tokens: string[] = [];
  const visit = (node: ts.Node): void => {
    if (isClassStatement(node) || isStyleImport(node) || isClassAttribute(node, classKeys)) {
      return;
    }
    if (ts.isJsxText(node)) {
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(source);
      if (TEXT_ATTRIBUTES.has(name)) {
        tokens.push(name);
        return;
      }
    }
    // Prettier puts JSX of more than one line in parentheses, and a class attribute changes the lines.
    if (ts.isParenthesizedExpression(node) && isJsx(node.expression)) {
      visit(node.expression);
      return;
    }
    if (node.getChildCount(source) === 0) {
      const token = node.getText(source);
      if (token !== '') {
        tokens.push(token);
      }
      return;
    }
    for (const child of node.getChildren(source)) {
      visit(child);
    }
  };
  visit(source);
  return tokens;
}

interface FileTokens {
  name: string;
  tokens: string[];
}

function baseUiTokens(files: DemoFile[]): FileTokens[] {
  return files
    .toSorted(byName)
    .map(({ name, text }) => ({ name, tokens: scriptTokens(text, ts.ScriptKind.TSX, false) }));
}

/**
 * Whether the two variants of a demo of Base UI differ in more than their classes and their text.
 * The files are the `.ts` and `.tsx` files of the two variant folders, with their names in the folder.
 */
export function baseUiVariantsDiffer(cssModules: DemoFile[], tailwind: DemoFile[]): boolean {
  const a = baseUiTokens(cssModules);
  const b = baseUiTokens(tailwind);
  return (
    !sameList(
      a.map(({ name }) => name),
      b.map(({ name }) => name),
    ) || a.some(({ tokens }, index) => !sameList(tokens, b[index].tokens))
  );
}

function textOf(node: TemplateNode): string {
  const content = typeof node.content === 'object' ? node.content.content : node.content;
  return collapseSpace(content ?? '');
}

/** The text of a text node or an interpolation, or no item for a node of another kind. */
function contentTexts(node: TemplateNode): string[] {
  const text = textOf(node);
  if (node.type === TEXT && text !== '') {
    return [JSON.stringify(text)];
  }
  return node.type === INTERPOLATION ? [`{{ ${text} }}`] : [];
}

function elementText(node: TemplateNode): string {
  const attributes = (node.props ?? []).flatMap(({ type, name, rawName, value, arg, exp }) => {
    if (type === ATTRIBUTE) {
      return name === 'class' ? [] : [value === undefined ? name : `${name}="${value.content}"`];
    }
    if (type === DIRECTIVE && name === 'bind' && arg?.content === 'class') {
      return [];
    }
    const written = rawName ?? name;
    return [exp?.content === undefined ? written : `${written}="${collapseSpace(exp.content)}"`];
  });
  return `<${[node.tag, ...attributes].join(' ')}>`;
}

/** The text attributes of an element, as `aria-label="Close"` or `:aria-label="label"`. */
function attributeTexts(node: TemplateNode): string[] {
  return (node.props ?? []).flatMap(({ type, name, value, arg, exp }) => {
    if (type === ATTRIBUTE && TEXT_ATTRIBUTES.has(name) && value !== undefined) {
      return [`${name}="${value.content}"`];
    }
    const bound = arg?.content;
    if (
      type === DIRECTIVE &&
      name === 'bind' &&
      bound !== undefined &&
      TEXT_ATTRIBUTES.has(bound)
    ) {
      return [`:${bound}="${exp?.content ?? ''}"`];
    }
    return [];
  });
}

interface FileForm {
  name: string;
  /** The elements and the texts of the template in tree order. */
  template: string[];
  /** The tokens of the script blocks. */
  script: string[];
}

function fileForm({ name, text }: DemoFile): FileForm {
  if (!name.endsWith('.vue')) {
    return { name, template: [], script: scriptTokens(text, ts.ScriptKind.TS, true) };
  }
  const { nodes, scripts } = readVueFile(text);
  return {
    name,
    template: nodes.flatMap((node) =>
      node.type === ELEMENT ? [elementText(node)] : contentTexts(node),
    ),
    script: scripts.flatMap((script) => scriptTokens(script, ts.ScriptKind.TS, true)),
  };
}

/** The forms of the files of a variant, by name. A file that gives no token, such as a file of class constants, is left out. */
function variantForms(files: DemoFile[]): FileForm[] {
  return files
    .toSorted(byName)
    .map(fileForm)
    .filter(({ template, script }) => template.length + script.length > 0);
}

function firstDifference(
  a: string[],
  b: string[],
): [string | undefined, string | undefined] | undefined {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a.at(index) !== b.at(index)) {
      return [a.at(index), b.at(index)];
    }
  }
  return undefined;
}

function describeDifference(
  [cssModules, tailwind]: [string | undefined, string | undefined],
  where: [string, string],
): string {
  return `${where[0]} has ${cssModules ?? 'nothing'} where ${where[1]} has ${tailwind ?? 'nothing'}`;
}

function formDifference(cssModules: DemoFile[], tailwind: DemoFile[]): string | undefined {
  const a = variantForms(cssModules);
  const b = variantForms(tailwind);
  const names = [a, b].map((forms) => forms.map(({ name }) => name));
  if (!sameList(names[0], names[1])) {
    const list = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'no file');
    return `css-modules has ${list(names[0])} where tailwind has ${list(names[1])}`;
  }
  for (const [index, form] of a.entries()) {
    const other = b[index];
    const difference =
      firstDifference(form.template, other.template) ?? firstDifference(form.script, other.script);
    if (difference !== undefined) {
      return describeDifference(difference, [`css-modules/${form.name}`, `tailwind/${other.name}`]);
    }
  }
  return undefined;
}

interface FileText {
  file: string;
  text: string;
}

/** The texts of the `.vue` files of a variant in the sequence of the file names. */
function variantTexts(files: DemoFile[]): FileText[] {
  return files
    .filter(({ name }) => name.endsWith('.vue'))
    .toSorted(byName)
    .flatMap(({ name, text }) =>
      readVueFile(text).nodes.flatMap((node) =>
        (node.type === ELEMENT ? attributeTexts(node) : contentTexts(node)).map((item) => ({
          file: name,
          text: item,
        })),
      ),
    );
}

function textDifference(cssModules: DemoFile[], tailwind: DemoFile[]): string | undefined {
  const a = variantTexts(cssModules);
  const b = variantTexts(tailwind);
  if (a.length !== b.length) {
    return undefined;
  }
  const index = a.findIndex(({ text }, position) => text !== b[position].text);
  return index < 0
    ? undefined
    : describeDifference(
        [a[index].text, b[index].text],
        [`css-modules/${a[index].file}`, `tailwind/${b[index].file}`],
      );
}

/**
 * The first difference between the two variants of a Vue demo. Each argument holds the `.vue` and
 * `.ts` files of a variant folder, with their names in the folder.
 */
export function compareVueVariants(
  cssModules: DemoFile[],
  tailwind: DemoFile[],
): VariantDifference {
  return {
    form: formDifference(cssModules, tailwind),
    text: textDifference(cssModules, tailwind),
  };
}
