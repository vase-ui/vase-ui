import { Lexer } from 'marked';
import type { Token, Tokens } from 'marked';
import ts from 'typescript';

export interface PropRow {
  name: string;
  required: boolean;
  type: string;
  default: string | null;
}

export interface StateField {
  name: string;
  optional: boolean;
  type: string;
}

export interface AttributeRow {
  name: string;
  type: string | null;
}

export interface TableRows {
  label: string;
  rows: Record<string, string | null>[];
}

export interface SurfacePart {
  name: string;
  tag: string | null;
  props: PropRow[] | null;
  state: { name: string; fields: StateField[]; code: string } | null;
  actions: { name: string; members: string[]; code: string } | null;
  changeEventReason: { name: string; values: string[]; code: string } | null;
  changeEventDetails: { name: string; code: string } | null;
  dataAttributes: AttributeRow[];
  cssVariables: AttributeRow[];
  tables?: TableRows[];
  code?: string[];
}

export interface SurfaceFunction {
  name: string;
  tables: TableRows[];
  code: string[];
}

export interface NamedCode {
  name: string;
  code: string;
}

export interface AdditionalType extends NamedCode {
  constants?: { name: string; value: string }[];
}

export interface SurfaceFile {
  file: string;
  parts: SurfacePart[];
  functions: SurfaceFunction[];
  types: NamedCode[];
  additionalTypes: AdditionalType[];
  externalTypes: NamedCode[];
}

type LabelKind =
  | 'props'
  | 'dataAttributes'
  | 'cssVariables'
  | 'parameters'
  | 'returnValue'
  | 'properties'
  | 'methods'
  | 'skipped';

interface Entry {
  title: string;
  nodes: Token[];
}

interface Section {
  title: string;
  nodes: Token[];
  entries: Entry[];
}

interface EntryTable {
  kind: LabelKind;
  header: string[];
  rows: string[][];
}

interface EntryContent {
  description: string;
  tables: EntryTable[];
  code: { lang: string; text: string }[];
}

const READ_SECTIONS = new Set(['API Reference', 'Additional Types', 'External Types']);
const SKIPPED_SECTIONS = new Set(['Export Groups', 'Canonical Types', 'External Type Links']);

const LABELS: [RegExp, LabelKind][] = [
  [/^\S+ Props$/, 'props'],
  [/^\S+ Data Attributes$/, 'dataAttributes'],
  [/^\S+ CSS Variables$/, 'cssVariables'],
  [/^(?:\S+ )?Parameters$/, 'parameters'],
  [/^(?:\S+ )?Return Value$/, 'returnValue'],
  [/^Properties$/, 'properties'],
  [/^Methods$/, 'methods'],
  [/^\S+ Prop (?:Example|References)$/, 'skipped'],
];

const HEADERS: Partial<Record<LabelKind, string[]>> = {
  props: ['Prop', 'Type', 'Default', 'Description'],
  dataAttributes: ['Attribute', 'Type', 'Description'],
  cssVariables: ['Variable', 'Type', 'Description'],
  parameters: ['Parameter', 'Type', 'Default', 'Description'],
  properties: ['Property', 'Type', 'Modifiers', 'Description'],
};

const TABLE_LABELS: Partial<Record<LabelKind, string>> = {
  parameters: 'Parameters',
  properties: 'Properties',
};

const FOLDED_SUFFIXES = new Set([
  'Props',
  'State',
  'Actions',
  'ChangeEventReason',
  'ChangeEventDetails',
]);

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

export function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function dash(text: string): string | null {
  return text === '-' ? null : text;
}

function plain(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      if (token.type === 'codespan') {
        return token.text;
      }
      if (token.type === 'br') {
        return '\n';
      }
      if ('tokens' in token && token.tokens) {
        return plain(token.tokens);
      }
      return 'text' in token ? token.text : token.raw;
    })
    .join('');
}

function splitSections(file: string, tokens: Token[]): Section[] {
  const sections: Section[] = [];
  let section: Section | undefined;
  let entry: Entry | undefined;
  for (const token of tokens) {
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading;
      const title = squash(plain(heading.tokens));
      if (heading.depth === 1) {
        continue;
      }
      if (heading.depth === 2) {
        section = { title, nodes: [], entries: [] };
        sections.push(section);
        entry = undefined;
        continue;
      }
      if (heading.depth === 3 && section) {
        entry = { title, nodes: [] };
        section.entries.push(entry);
        continue;
      }
      throw new Error(
        `${file}: the heading "${title}" is at a place that the reader does not know. Teach scripts/parity/typesMd.ts the form.`,
      );
    }
    if (entry) {
      entry.nodes.push(token);
    } else if (section) {
      section.nodes.push(token);
    } else if (token.type !== 'space' && token.type !== 'def') {
      throw new Error(
        `${file}: the Markdown element "${token.type}" is before the first section. Teach scripts/parity/typesMd.ts the form.`,
      );
    }
  }
  return sections;
}

function readTable(token: Tokens.Table): { header: string[]; rows: string[][] } {
  const cell = (item: Tokens.TableCell): string => squash(plain(item.tokens));
  return { header: token.header.map(cell), rows: token.rows.map((row) => row.map(cell)) };
}

function labelOf(token: Token): string | undefined {
  if (token.type !== 'paragraph') {
    return undefined;
  }
  const { tokens } = token as Tokens.Paragraph;
  if (tokens.length !== 1 || tokens[0].type !== 'strong') {
    return undefined;
  }
  return squash(plain(tokens)).replace(/:$/, '');
}

function readEntry(file: string, entry: Entry): EntryContent {
  const content: EntryContent = { description: '', tables: [], code: [] };
  const description: string[] = [];
  let label: { text: string; kind: LabelKind } | undefined;
  for (const token of entry.nodes) {
    const labelText = labelOf(token);
    if (labelText !== undefined) {
      const found = LABELS.find(([pattern]) => pattern.test(labelText));
      if (!found) {
        throw new Error(
          `${file}: "${entry.title}": the label "${labelText}" is not known. Teach scripts/parity/typesMd.ts the label.`,
        );
      }
      label = { text: labelText, kind: found[1] };
    } else if (token.type === 'paragraph') {
      if (!label) {
        description.push(plain((token as Tokens.Paragraph).tokens));
      }
    } else if (token.type === 'table') {
      const table = readTable(token as Tokens.Table);
      const expected = label ? HEADERS[label.kind] : undefined;
      if (!label || !expected) {
        throw new Error(
          `${file}: "${entry.title}": a table with the header "${table.header.join(' | ')}" has no label that the reader knows. Teach scripts/parity/typesMd.ts the table.`,
        );
      }
      if (table.header.join(' | ') !== expected.join(' | ')) {
        throw new Error(
          `${file}: "${entry.title}": the table under "${label.text}" has the header "${table.header.join(' | ')}". The reader knows the header "${expected.join(' | ')}" here.`,
        );
      }
      content.tables.push({ kind: label.kind, ...table });
    } else if (token.type === 'code') {
      if (label?.kind !== 'skipped') {
        const { lang = '', text } = token as Tokens.Code;
        content.code.push({ lang, text });
      }
    } else if (token.type !== 'space' && !(token.type === 'list' && label?.kind === 'skipped')) {
      throw new Error(
        `${file}: "${entry.title}": the Markdown element "${token.type}" is not known. Teach scripts/parity/typesMd.ts the element.`,
      );
    }
  }
  content.description = description.join('\n');
  return content;
}

function parseCode(file: string, title: string, block: { lang: string; text: string }) {
  if (block.lang !== 'typescript' && block.lang !== 'tsx') {
    throw new Error(
      `${file}: "${title}": the code block language "${block.lang}" is not known. Teach scripts/parity/typesMd.ts the language.`,
    );
  }
  const kind = block.lang === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile('block.ts', block.text, ts.ScriptTarget.Latest, true, kind);
}

function printCode(file: string, title: string, block: { lang: string; text: string }): string {
  return printer.printFile(parseCode(file, title, block)).trim();
}

function onlyCode(file: string, title: string, content: EntryContent) {
  if (content.code.length !== 1) {
    throw new Error(
      `${file}: "${title}" has ${content.code.length} code blocks. The reader expects one.`,
    );
  }
  return content.code[0];
}

function firstStatement(file: string, title: string, content: EntryContent) {
  const block = onlyCode(file, title, content);
  const source = parseCode(file, title, block);
  return { source, statement: source.statements[0], code: printCode(file, title, block) };
}

function aliasOf(file: string, title: string, content: EntryContent) {
  const { source, statement, code } = firstStatement(file, title, content);
  if (
    !statement ||
    (!ts.isTypeAliasDeclaration(statement) && !ts.isInterfaceDeclaration(statement))
  ) {
    throw new Error(`${file}: "${title}": the code is not a type alias or an interface.`);
  }
  return { source, declaration: statement, name: statement.name.text, code };
}

function memberName(file: string, title: string, member: ts.TypeElement): string {
  const name = member.name;
  if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
    return name.text;
  }
  throw new Error(
    `${file}: "${title}": a member of the type has a name that the reader does not know.`,
  );
}

function membersOf(
  file: string,
  title: string,
  declaration: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
): readonly ts.TypeElement[] {
  if (ts.isInterfaceDeclaration(declaration)) {
    return declaration.members;
  }
  if (ts.isTypeLiteralNode(declaration.type)) {
    return declaration.type.members;
  }
  throw new Error(`${file}: "${title}": the type is not an object type.`);
}

function readState(file: string, title: string, content: EntryContent) {
  const { source, declaration, name, code } = aliasOf(file, title, content);
  const fields = membersOf(file, title, declaration).map((member) => ({
    name: memberName(file, title, member),
    optional: member.questionToken !== undefined,
    type:
      ts.isPropertySignature(member) && member.type
        ? squash(member.type.getText(source))
        : squash(member.getText(source)),
  }));
  return { name, fields, code };
}

function readActions(file: string, title: string, content: EntryContent) {
  const { declaration, name, code } = aliasOf(file, title, content);
  const members = membersOf(file, title, declaration).map((member) =>
    memberName(file, title, member),
  );
  return { name, members, code };
}

function stringLiteralValues(file: string, title: string, type: ts.TypeNode): string[] {
  const items = ts.isUnionTypeNode(type) ? type.types : [type];
  return items.map((item) => {
    if (ts.isLiteralTypeNode(item) && ts.isStringLiteral(item.literal)) {
      return item.literal.text;
    }
    throw new Error(`${file}: "${title}": a member of the union is not a string.`);
  });
}

function readReason(file: string, title: string, content: EntryContent) {
  const { declaration, name, code } = aliasOf(file, title, content);
  if (!ts.isTypeAliasDeclaration(declaration)) {
    throw new Error(`${file}: "${title}": the code is not a type alias.`);
  }
  return { name, values: stringLiteralValues(file, title, declaration.type), code };
}

function readDetails(file: string, title: string, content: EntryContent) {
  const { name, code } = aliasOf(file, title, content);
  return { name, code };
}

function readConstants(file: string, title: string, content: EntryContent) {
  const { source, statement } = firstStatement(file, title, content);
  if (!statement || !ts.isModuleDeclaration(statement)) {
    return undefined;
  }
  if (!statement.body || !ts.isModuleBlock(statement.body)) {
    throw new Error(`${file}: "${title}": the namespace has no body.`);
  }
  return statement.body.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) {
      throw new Error(
        `${file}: "${title}": the namespace holds a statement that is not a constant.`,
      );
    }
    return statement.declarationList.declarations.map((item) => {
      const type = item.type;
      if (!type || !ts.isLiteralTypeNode(type) || !ts.isStringLiteral(type.literal)) {
        throw new Error(
          `${file}: "${title}": the constant "${item.name.getText(source)}" is not a string.`,
        );
      }
      return { name: item.name.getText(source), value: type.literal.text };
    });
  });
}

function tableRows(table: EntryTable): Record<string, string | null>[] {
  const keys = table.header.map((title, index) => (index === 0 ? 'name' : title.toLowerCase()));
  return table.rows.map((row) =>
    Object.fromEntries(
      keys.flatMap((key, index) => (key === 'description' ? [] : [[key, dash(row[index])]])),
    ),
  );
}

function otherTables(content: EntryContent): TableRows[] {
  return content.tables.flatMap((table) => {
    const label = TABLE_LABELS[table.kind];
    return label ? [{ label, rows: tableRows(table) }] : [];
  });
}

function printedCode(file: string, title: string, content: EntryContent): string[] {
  return content.code.map((block) => printCode(file, title, block));
}

/** The type in the `type ReturnValue = …;` of the code of an entry, or `undefined` when the entry has none. */
export function documentedReturnType(code: readonly string[] | undefined): string | undefined {
  for (const block of code ?? []) {
    const source = ts.createSourceFile('block.ts', block, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (ts.isTypeAliasDeclaration(statement) && statement.name.text === 'ReturnValue') {
        return squash(statement.type.getText(source));
      }
    }
  }
  return undefined;
}

function propRow(row: string[]): PropRow {
  const [name, type, defaultValue] = row;
  return {
    name: name.replace(/\*$/, ''),
    required: name.endsWith('*'),
    type,
    default: dash(defaultValue),
  };
}

function attributeRows(content: EntryContent, kind: LabelKind): AttributeRow[] {
  const table = content.tables.find((item) => item.kind === kind);
  return (table?.rows ?? []).map(([name, type]) => ({ name, type: dash(type) }));
}

function tagOf(description: string): string | null {
  return /\bRenders an? <([a-z][a-z0-9-]*)>/.exec(description)?.[1] ?? null;
}

function readApiReference(file: string, entries: Entry[]) {
  const contents = new Map(entries.map((entry) => [entry.title, readEntry(file, entry)]));
  const isPart = (title: string): boolean => {
    const content = contents.get(title);
    return (
      content !== undefined &&
      (content.tables.some((table) => table.kind === 'props') || contents.has(`${title}.State`))
    );
  };
  const parts: SurfacePart[] = [];
  const functions: SurfaceFunction[] = [];
  const types: NamedCode[] = [];
  for (const [title, content] of contents) {
    const dot = title.indexOf('.');
    if (dot !== -1) {
      if (FOLDED_SUFFIXES.has(title.slice(dot + 1)) && isPart(title.slice(0, dot))) {
        continue;
      }
      types.push({ name: title, code: printCode(file, title, onlyCode(file, title, content)) });
    } else if (isPart(title)) {
      const folded = (suffix: string): { title: string; content: EntryContent } | undefined => {
        const foldedTitle = `${title}.${suffix}`;
        const foldedContent = contents.get(foldedTitle);
        return foldedContent && { title: foldedTitle, content: foldedContent };
      };
      const props = content.tables.find((table) => table.kind === 'props');
      const state = folded('State');
      const actions = folded('Actions');
      const reason = folded('ChangeEventReason');
      const details = folded('ChangeEventDetails');
      const tables = otherTables(content);
      const code = printedCode(file, title, content);
      parts.push({
        name: title,
        tag: tagOf(content.description),
        props: props ? props.rows.map(propRow) : null,
        state: state ? readState(file, state.title, state.content) : null,
        actions: actions ? readActions(file, actions.title, actions.content) : null,
        changeEventReason: reason ? readReason(file, reason.title, reason.content) : null,
        changeEventDetails: details ? readDetails(file, details.title, details.content) : null,
        dataAttributes: attributeRows(content, 'dataAttributes'),
        cssVariables: attributeRows(content, 'cssVariables'),
        ...(tables.length > 0 ? { tables } : {}),
        ...(code.length > 0 ? { code } : {}),
      });
    } else {
      functions.push({
        name: title,
        tables: otherTables(content),
        code: printedCode(file, title, content),
      });
    }
  }
  return { parts, functions, types };
}

/** Reads one `types.md` of Base UI. The reader fails on each section, label and table that it does not know. */
export function readTypesMd(file: string, text: string): SurfaceFile {
  const sections = splitSections(file, new Lexer({ gfm: true }).lex(text));
  const surface: SurfaceFile = {
    file,
    parts: [],
    functions: [],
    types: [],
    additionalTypes: [],
    externalTypes: [],
  };
  for (const section of sections) {
    if (SKIPPED_SECTIONS.has(section.title)) {
      continue;
    }
    if (!READ_SECTIONS.has(section.title)) {
      throw new Error(
        `${file}: the section "${section.title}" is not known. Teach scripts/parity/typesMd.ts the section.`,
      );
    }
    const stray = section.nodes.find((token) => token.type !== 'space');
    if (stray) {
      throw new Error(
        `${file}: the section "${section.title}" has the Markdown element "${stray.type}" outside an entry. Teach scripts/parity/typesMd.ts the form.`,
      );
    }
    if (section.title === 'API Reference') {
      Object.assign(surface, readApiReference(file, section.entries));
      continue;
    }
    const target =
      section.title === 'Additional Types' ? surface.additionalTypes : surface.externalTypes;
    for (const entry of section.entries) {
      const content = readEntry(file, entry);
      const code = printCode(file, entry.title, onlyCode(file, entry.title, content));
      const constants =
        section.title === 'Additional Types'
          ? readConstants(file, entry.title, content)
          : undefined;
      target.push({ name: entry.title, code, ...(constants ? { constants } : {}) });
    }
  }
  return surface;
}
