import ts from 'typescript';
import { ATTRIBUTE, DIRECTIVE, ELEMENT, readVueFile } from './vueFile.ts';

/** A constant that holds class names has a name that ends with one of these words. */
export const CLASS_CONSTANT = /Class(?:Name|es)?$/;

/**
 * The class strings of a folder by element name, as the file writes the name: `Switch.Root`, `div`.
 * Each list is in the sequence of the code units and keeps each repeat.
 */
export type ClassRow = Record<string, string[]>;

/** A file of a demo folder. The name is the name of the file in the folder. */
export interface DemoFile {
  name: string;
  text: string;
}

/** The name in a row for the strings of a `class` key in an object that no call receives. */
const NO_ELEMENT = '(no element)';

type ClassPart = { kind: 'string'; text: string } | { kind: 'constant'; name: string };

interface ClassUse {
  tag: string;
  parts: ClassPart[];
}

interface ClassConstant {
  name: string;
  parts: ClassPart[];
}

interface FileClasses {
  uses: ClassUse[];
  constants: ClassConstant[];
  /** The exported name of each import that has another local name, by the local name. */
  aliases: Map<string, string>;
  /** The tag of the one element that each component of the file makes, by the name of the component. */
  components: Map<string, string>;
}

/** The text with one space between its words and none at its ends. */
export function collapseSpace(text: string): string {
  return text.trim().split(/\s+/).join(' ');
}

function newFileClasses(): FileClasses {
  return { uses: [], constants: [], aliases: new Map(), components: new Map() };
}

/** The strings and the class constants of an expression, at any depth, in the sequence of the source. */
function collectParts(node: ts.Node, parts: ClassPart[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    parts.push({ kind: 'string', text: node.text });
  } else if (ts.isTemplateExpression(node)) {
    parts.push({ kind: 'string', text: node.head.text });
    for (const span of node.templateSpans) {
      collectParts(span.expression, parts);
      parts.push({ kind: 'string', text: span.literal.text });
    }
  } else if (ts.isIdentifier(node) && CLASS_CONSTANT.test(node.text)) {
    parts.push({ kind: 'constant', name: node.text });
  } else {
    ts.forEachChild(node, (child) => {
      collectParts(child, parts);
    });
  }
}

function classParts(node: ts.Node): ClassPart[] {
  const parts: ClassPart[] = [];
  collectParts(node, parts);
  return parts.flatMap((part): ClassPart[] => {
    if (part.kind === 'constant') {
      return [part];
    }
    const text = collapseSpace(part.text);
    return text === '' ? [] : [{ kind: 'string', text }];
  });
}

function isClassKey(name: ts.PropertyName): boolean {
  return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'class';
}

function tagText(node: ts.Expression, source: ts.SourceFile): string {
  return ts.isStringLiteral(node) ? node.text : node.getText(source);
}

/** The tag of the first JSX element in a node. */
function firstJsxTag(node: ts.Node, source: ts.SourceFile): string | undefined {
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText(source);
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText(source);
  }
  return ts.forEachChild(node, (child) => firstJsxTag(child, source));
}

/** The tag of the element that a Vue component makes with `h`, as in `() => h('svg', …)`. */
function hElementTag(node: ts.Expression, source: ts.SourceFile): string | undefined {
  if (
    !ts.isArrowFunction(node) ||
    !ts.isCallExpression(node.body) ||
    node.body.expression.getText(source) !== 'h'
  ) {
    return undefined;
  }
  const first = node.body.arguments.at(0);
  return first === undefined ? undefined : tagText(first, source);
}

/**
 * The tag of the element that an object with a `class` key is for. It is the first argument of the
 * nearest call that has the object, or a call around the object, as a later argument.
 */
function callTag(object: ts.Node, source: ts.SourceFile): string | undefined {
  let child = object;
  let parent = object.parent;
  while (!ts.isSourceFile(parent)) {
    if (ts.isCallExpression(parent)) {
      const [first, ...later] = parent.arguments;
      if (later.some((argument) => argument === child)) {
        return tagText(first, source);
      }
    }
    child = parent;
    parent = parent.parent;
  }
  return undefined;
}

function readScript(
  classes: FileClasses,
  text: string,
  scriptKind: ts.ScriptKind,
  classKeys: boolean,
): void {
  const source = ts.createSourceFile('demo', text, ts.ScriptTarget.Latest, true, scriptKind);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const { name, propertyName } of bindings.elements) {
          if (propertyName !== undefined) {
            classes.aliases.set(name.text, propertyName.text);
          }
        }
      }
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const tag = firstJsxTag(node.body, source);
      if (tag !== undefined) {
        classes.components.set(node.name.text, tag);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (CLASS_CONSTANT.test(node.name.text)) {
        classes.constants.push({ name: node.name.text, parts: classParts(node.initializer) });
        return;
      }
      const tag = hElementTag(node.initializer, source);
      if (tag !== undefined) {
        classes.components.set(node.name.text, tag);
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'className' &&
      node.initializer
    ) {
      classes.uses.push({
        tag: node.parent.parent.tagName.getText(source),
        parts: classParts(node.initializer),
      });
      return;
    }
    if (classKeys && ts.isPropertyAssignment(node) && isClassKey(node.name)) {
      classes.uses.push({
        tag: callTag(node.parent, source) ?? NO_ELEMENT,
        parts: classParts(node.initializer),
      });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function readVueClasses(text: string): FileClasses {
  const classes = newFileClasses();
  const { nodes, scripts } = readVueFile(text);
  for (const script of scripts) {
    readScript(classes, script, ts.ScriptKind.TS, true);
  }
  for (const node of nodes) {
    if (node.type !== ELEMENT || node.tag === undefined) {
      continue;
    }
    for (const prop of node.props ?? []) {
      if (prop.type === ATTRIBUTE && prop.name === 'class' && prop.value !== undefined) {
        const classText = collapseSpace(prop.value.content);
        classes.uses.push({
          tag: node.tag,
          parts: classText === '' ? [] : [{ kind: 'string', text: classText }],
        });
      } else if (
        prop.type === DIRECTIVE &&
        prop.name === 'bind' &&
        prop.arg?.content === 'class' &&
        prop.exp?.content !== undefined
      ) {
        // The parentheses make an object or an array at the start an expression.
        const expression = ts.createSourceFile(
          'class.ts',
          `(${prop.exp.content})`,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        classes.uses.push({ tag: node.tag, parts: classParts(expression) });
      }
    }
  }
  return classes;
}

/** The element name of a tag: the element that a component of the file makes, and the exported name of an import. */
function elementName(file: FileClasses, tag: string): string {
  const [head = tag, ...rest] = (file.components.get(tag) ?? tag).split('.');
  return [file.aliases.get(head) ?? head, ...rest].join('.');
}

/** The class constants that a name means in a file: its own, or else those of the other files. */
function resolveConstants(
  files: FileClasses[],
  from: FileClasses,
  name: string,
): { file: FileClasses; constant: ClassConstant }[] {
  const declared = (file: FileClasses) =>
    file.constants
      .filter((constant) => constant.name === name)
      .map((constant) => ({ file, constant }));
  const own = declared(from);
  return own.length > 0 ? own : files.filter((file) => file !== from).flatMap(declared);
}

function buildRow(files: FileClasses[]): ClassRow {
  const row = new Map<string, string[]>();
  const add = (element: string, strings: string[]): void => {
    if (strings.length > 0) {
      row.set(element, [...(row.get(element) ?? []), ...strings]);
    }
  };
  const elementsOf = new Map<ClassConstant, Set<string>>();
  const markUsed = (
    from: FileClasses,
    name: string,
    element: string,
    seen: Set<ClassConstant>,
  ): void => {
    for (const { file, constant } of resolveConstants(files, from, name)) {
      if (seen.has(constant)) {
        continue;
      }
      seen.add(constant);
      elementsOf.set(constant, (elementsOf.get(constant) ?? new Set()).add(element));
      for (const part of constant.parts) {
        if (part.kind === 'constant') {
          markUsed(file, part.name, element, seen);
        }
      }
    }
  };
  for (const file of files) {
    for (const { tag, parts } of file.uses) {
      const element = elementName(file, tag);
      for (const part of parts) {
        if (part.kind === 'string') {
          add(element, [part.text]);
        } else {
          markUsed(file, part.name, element, new Set());
        }
      }
    }
  }
  for (const file of files) {
    for (const constant of file.constants) {
      const strings = constant.parts.flatMap((part) => (part.kind === 'string' ? [part.text] : []));
      for (const element of elementsOf.get(constant) ?? [constant.name]) {
        add(element, strings);
      }
    }
  }
  // A sort of strings with no function compares the code units. The row then does not depend on the
  // collation data of the machine.
  return Object.fromEntries(
    [...row]
      .map(([element, strings]): [string, string[]] => [element, strings.toSorted()])
      .toSorted(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/**
 * The class strings of the files of one folder of Base UI, by element name. A class attribute is a
 * `className` attribute. A string that a class attribute has counts one time for each such
 * attribute. A string of a class constant counts one time for each element name whose class
 * attribute names the constant, also through another class constant. A class constant that no
 * class attribute names gives its strings to its own name.
 */
export function classRowOfBaseUi(files: DemoFile[]): ClassRow {
  return buildRow(
    files.map(({ text }) => {
      const classes = newFileClasses();
      readScript(classes, text, ts.ScriptKind.TSX, false);
      return classes;
    }),
  );
}

/**
 * The class strings of the files of one folder of a Vue demo, by element name, with the rules of
 * `classRowOfBaseUi`. A class attribute is a `class` attribute, a `:class` binding, and the `class`
 * key of an object literal in a script block or a `.ts` file, as an `h()` call has it.
 */
export function classRowOfVue(files: DemoFile[]): ClassRow {
  return buildRow(
    files.map(({ name, text }) => {
      if (name.endsWith('.vue')) {
        return readVueClasses(text);
      }
      const classes = newFileClasses();
      readScript(classes, text, ts.ScriptKind.TS, true);
      return classes;
    }),
  );
}
