import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createChecker } from 'vue-component-meta';

export interface PropSurface {
  required: boolean;
  default: string | null;
  description: string;
  type: string;
}

/** An emit or an exposed member. For an emit, `type` is the list of its arguments. */
export interface MemberSurface {
  type: string;
  description: string;
}

export interface SlotSurface {
  description: string;
  props: { name: string; type: string }[];
}

export interface ComponentSurface {
  /** The JSDoc of the export. */
  description: string;
  props: Map<string, PropSurface>;
  emits: Map<string, MemberSurface>;
  slots: Map<string, SlotSurface>;
  exposed: Map<string, MemberSurface>;
}

export interface ConstantSurface {
  name: string;
  /** `undefined` when the constant is not a string. */
  value: string | undefined;
  description: string;
  /** The text of the `@type` tag, without the braces. */
  type: string | null;
}

export interface ExportMatch {
  /** `Root` for a direct export of the entry file, `Dialog.Root` for a member of a namespace export. */
  path: string;
  symbol: ts.Symbol;
}

export interface VaseProject {
  findExports: (entryFile: string, name: string) => ExportMatch[];
  /** `undefined` when the export does not come from a `.vue` file. */
  readComponent: (match: ExportMatch) => ComponentSurface | undefined;
  /** The field names of an exported type, or `undefined` when the entry file has no such type. */
  readFields: (entryFile: string, typeName: string) => string[] | undefined;
  /** The string values of an exported union type. `undefined` when there is no such type or it is not a union of strings. */
  readUnionValues: (entryFile: string, typeName: string) => string[] | undefined;
  /** The constants of an exported namespace, or `undefined` when the entry file has no such namespace. */
  readConstants: (entryFile: string, namespaceName: string) => ConstantSurface[] | undefined;
  /** The return type of each call signature of the export, joined with ` | `. `undefined` when the export has no call signature. */
  readReturnType: (match: ExportMatch) => string | undefined;
  /** Gives vue-component-meta and the SFC compiler another text for a file. */
  updateFile: (path: string, text: string) => void;
}

function jsDocText(node: ts.Node): string {
  return ts
    .getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .map((doc) =>
      typeof doc.comment === 'string'
        ? doc.comment
        : (doc.comment ?? []).map((part) => part.text).join(''),
    )
    .join(' ');
}

/** vue-component-meta gives an empty description for an event, so the JSDoc of `defineEmits` gives it. */
export function readEmitDescriptions(source: string, file: string): Map<string, string> {
  const setup = parse(source, { filename: file }).descriptor.scriptSetup;
  const descriptions = new Map<string, string>();
  if (!setup) {
    return descriptions;
  }
  const sourceFile = ts.createSourceFile(
    'setup.ts',
    setup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineEmits'
    ) {
      const type = node.typeArguments?.[0];
      for (const member of type && ts.isTypeLiteralNode(type) ? type.members : []) {
        let name: string | undefined;
        if (ts.isPropertySignature(member)) {
          name = member.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
        } else if (ts.isCallSignatureDeclaration(member)) {
          const first = member.parameters[0]?.type;
          if (first && ts.isLiteralTypeNode(first) && ts.isStringLiteral(first.literal)) {
            name = first.literal.text;
          }
        }
        if (name !== undefined) {
          descriptions.set(name, jsDocText(member));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return descriptions;
}

/** The prop names are the keys that the SFC compiler reports as props. They do not include the native attributes. */
function readPropNames(source: string, file: string): string[] {
  const { descriptor } = parse(source, { filename: file });
  try {
    const { bindings } = compileScript(descriptor, { id: file });
    return Object.entries(bindings ?? {})
      .filter(([, type]) => type === 'props')
      .map(([name]) => name);
  } catch (error) {
    throw new Error(
      `${file}: the SFC compiler cannot read the props: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function createVaseProject(tsconfig: string): VaseProject {
  const checker = createChecker(tsconfig, { schema: false });
  const sources = new Map<string, string>();

  // The program changes after `updateFile`, so each read asks for the current one.
  const typeChecker = (): ts.TypeChecker => {
    const program = checker.getProgram();
    if (!program) {
      throw new Error(`The TypeScript program of ${tsconfig} did not load. Check that file.`);
    }
    return program.getTypeChecker();
  };
  const entrySymbol = (entryFile: string): ts.Symbol | undefined => {
    const sourceFile = checker.getProgram()?.getSourceFile(entryFile);
    return sourceFile && typeChecker().getSymbolAtLocation(sourceFile);
  };
  const resolve = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? typeChecker().getAliasedSymbol(symbol) : symbol;
  // The flags and the clean-up are those of vue-component-meta, so a slot prop reads like a prop.
  const typeText = (type: ts.Type): string =>
    typeChecker()
      .typeToString(
        type,
        undefined,
        ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.NoTruncation,
      )
      .replace(/import\(.*?\)\./g, '');
  const documentationOf = (symbol: ts.Symbol): string =>
    ts.displayPartsToString(symbol.getDocumentationComment(typeChecker()));
  const directExport = (entryFile: string, name: string): ts.Symbol | undefined => {
    const entry = entrySymbol(entryFile);
    return (
      entry &&
      typeChecker()
        .getExportsOfModule(entry)
        .find((symbol) => symbol.getName() === name)
    );
  };

  function sfcOf(symbol: ts.Symbol, depth = 0): string | undefined {
    const resolved = resolve(symbol);
    if (!(resolved.flags & ts.SymbolFlags.Value)) {
      return undefined;
    }
    for (const declaration of resolved.declarations ?? []) {
      const file = declaration.getSourceFile().fileName;
      if (file.endsWith('.vue')) {
        return file;
      }
      if (
        depth < 5 &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isIdentifier(declaration.initializer)
      ) {
        const target = typeChecker().getSymbolAtLocation(declaration.initializer);
        const found = target && sfcOf(target, depth + 1);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  const readSource = (path: string): string => sources.get(path) ?? readFileSync(path, 'utf8');

  return {
    findExports(entryFile, name) {
      const entry = entrySymbol(entryFile);
      if (!entry) {
        return [];
      }
      const matches: ExportMatch[] = [];
      for (const symbol of typeChecker().getExportsOfModule(entry)) {
        if (symbol.getName() === name) {
          matches.push({ path: name, symbol });
        }
        const resolved = resolve(symbol);
        if (resolved.flags & ts.SymbolFlags.Module) {
          for (const member of typeChecker().getExportsOfModule(resolved)) {
            if (member.getName() === name) {
              matches.push({ path: `${symbol.getName()}.${name}`, symbol: member });
            }
          }
        }
      }
      return matches;
    },

    readComponent({ symbol }) {
      const file = sfcOf(symbol);
      if (!file) {
        return undefined;
      }
      const source = readSource(file);
      const meta = checker.getComponentMeta(file);
      const documented = new Map(meta.props.map((prop) => [prop.name, prop]));
      const props = new Map<string, PropSurface>();
      for (const name of readPropNames(source, file)) {
        const prop = documented.get(name);
        if (!prop) {
          throw new Error(
            `${file}: the SFC compiler reads the prop "${name}", but vue-component-meta does not list it.`,
          );
        }
        props.set(name, {
          required: prop.required,
          default: prop.default ?? null,
          description: prop.description,
          type: prop.type,
        });
      }
      const emitDescriptions = readEmitDescriptions(source, file);
      return {
        description: documentationOf(resolve(symbol)),
        props,
        emits: new Map(
          meta.events.map(({ name, type }) => [
            name,
            { type, description: emitDescriptions.get(name) ?? '' },
          ]),
        ),
        slots: new Map(
          meta.slots.map((slot) => [
            slot.name,
            {
              description: slot.description,
              props: typeChecker()
                .getPropertiesOfType(slot.getTypeObject())
                .map((property) => ({
                  name: property.getName(),
                  type: typeText(typeChecker().getTypeOfSymbol(property)),
                })),
            },
          ]),
        ),
        exposed: new Map(
          meta.exposed.map(({ name, type, description }) => [name, { type, description }]),
        ),
      };
    },

    readFields(entryFile, typeName) {
      const symbol = directExport(entryFile, typeName);
      if (!symbol) {
        return undefined;
      }
      const type = typeChecker().getDeclaredTypeOfSymbol(resolve(symbol));
      return typeChecker()
        .getPropertiesOfType(type)
        .map(({ name }) => name);
    },

    readUnionValues(entryFile, typeName) {
      const symbol = directExport(entryFile, typeName);
      if (!symbol) {
        return undefined;
      }
      const type = typeChecker().getDeclaredTypeOfSymbol(resolve(symbol));
      const members = type.isUnion() ? type.types : [type];
      return members.every((member) => member.isStringLiteral())
        ? members.map((member) => (member as ts.StringLiteralType).value)
        : undefined;
    },

    readConstants(entryFile, namespaceName) {
      const symbol = directExport(entryFile, namespaceName);
      if (!symbol) {
        return undefined;
      }
      const namespace = resolve(symbol);
      return typeChecker()
        .getExportsOfModule(namespace)
        .map((member) => {
          const type = typeChecker().getTypeOfSymbol(member);
          const typeTag = member
            .getJsDocTags(typeChecker())
            .find(({ name }) => name === 'type')?.text;
          return {
            name: member.getName(),
            value: type.isStringLiteral() ? type.value : undefined,
            description: documentationOf(member),
            type: typeTag ? ts.displayPartsToString(typeTag).replace(/^\{(.*)\}$/s, '$1') : null,
          };
        });
    },

    readReturnType({ symbol }) {
      const signatures = typeChecker().getTypeOfSymbol(resolve(symbol)).getCallSignatures();
      if (signatures.length === 0) {
        return undefined;
      }
      const texts = signatures.map((signature) =>
        typeText(typeChecker().getReturnTypeOfSignature(signature)),
      );
      return [...new Set(texts)].join(' | ');
    },

    updateFile(path, text) {
      sources.set(path, text);
      checker.updateFile(path, text);
    },
  };
}
