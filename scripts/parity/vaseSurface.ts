import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createChecker } from 'vue-component-meta';

export interface PropSurface {
  required: boolean;
  default: string | null;
  description: string;
  type: string;
  /** Whether the JSDoc has the tag `@ignore`. The API reference then leaves the prop out, as the Base UI page does. */
  ignored: boolean;
}

/** An emit or an exposed member. For an emit, `type` is the list of its arguments, as `defineEmits` writes them. */
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

export interface ParameterSurface {
  name: string;
  type: string;
  /** Whether the signature marks the parameter as optional, or a shorter overload lacks it. */
  optional: boolean;
  /** The text of the `@param` tag. */
  description: string;
}

export interface FunctionSurface {
  /** The JSDoc of the export. */
  description: string;
  /** The parameters of the signature that has the most parameters. */
  parameters: ParameterSurface[];
  returns: {
    /** The text that `readReturnType` gives. */
    type: string;
    /** The text of the `@returns` tag. */
    description: string;
  };
}

export interface PropertySurface {
  name: string;
  type: string;
  optional: boolean;
  /** The text of the `@default` tag, or `null`. */
  default: string | null;
  description: string;
}

export interface ClassPropertySurface {
  name: string;
  type: string;
  /** Whether the property is a getter with no setter, or a field with the `readonly` modifier. */
  readonly: boolean;
  description: string;
}

export interface MethodSurface extends FunctionSurface {
  name: string;
}

/** The public members of a class, in the sequence of the declaration. A member with the `@internal` tag is not public. */
export interface ClassSurface {
  properties: ClassPropertySurface[];
  methods: MethodSurface[];
}

export interface ConstantSurface {
  name: string;
  /** `undefined` when the constant is not a string. */
  value: string | undefined;
  description: string;
  /** The text of the `@type` tag, without the braces. */
  type: string | null;
}

/** A block tag of a JSDoc, such as `@selector`. */
export interface TagSurface {
  /** The name of the tag, with no `@`. */
  name: string;
  /** The text of the tag, with each run of white space as one space. */
  text: string;
}

export interface ExportMatch {
  /** `Root` for a direct export of the entry file, `Dialog.Root` for a member of a namespace export. */
  path: string;
  symbol: ts.Symbol;
}

export interface VaseProject {
  findExports: (entryFile: string, name: string) => ExportMatch[];
  /** The export at `path`, such as `Root`, `Dialog.Handle` or `Dialog.Root.Props`. Each name before the last is a namespace. `undefined` when the entry file has no such export. */
  findExportAt: (entryFile: string, path: string) => ExportMatch | undefined;
  /** `undefined` when the export does not come from a `.vue` file. */
  readComponent: (match: ExportMatch) => ComponentSurface | undefined;
  /** The block tags of the JSDoc of the export, in their sequence. */
  readTags: (match: ExportMatch) => TagSurface[];
  /** The field names of an exported type, or `undefined` when the entry file has no such type. */
  readFields: (entryFile: string, typeName: string) => string[] | undefined;
  /** The string values of the union type at `path`, such as `Progress.Status`, in the sequence of the declaration. `undefined` when there is no such type or it is not a union of strings. */
  readUnionValues: (entryFile: string, path: string) => string[] | undefined;
  /** The constants of an exported namespace, or `undefined` when the entry file has no such namespace. */
  readConstants: (entryFile: string, namespaceName: string) => ConstantSurface[] | undefined;
  /** The return type of each call signature of the export, joined with ` | `. `undefined` when the export has no call signature. */
  readReturnType: (match: ExportMatch) => string | undefined;
  /** The parameters and the return value of an exported function. `undefined` when the export has no call signature. */
  readFunction: (match: ExportMatch) => FunctionSurface | undefined;
  /** The properties of the declared type of an exported type. `undefined` when the export is not a type. */
  readProperties: (match: ExportMatch) => PropertySurface[] | undefined;
  /** The public members of an exported class. `undefined` when the export is not a class. */
  readClass: (match: ExportMatch) => ClassSurface | undefined;
  /** Gives vue-component-meta and the SFC compiler another text for a file. */
  updateFile: (path: string, text: string) => void;
}

const NULLABLE = ts.TypeFlags.Null | ts.TypeFlags.Undefined;

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

/**
 * The events that the type literal of `defineEmits` declares, with the arguments as the source writes
 * them and the JSDoc. vue-component-meta gives an empty description. Its type text can lose the name
 * of an alias, such as `RadioGroupChangeEventDetails`.
 */
export function readEmits(source: string, file: string): Map<string, MemberSurface> {
  const setup = parse(source, { filename: file }).descriptor.scriptSetup;
  const emits = new Map<string, MemberSurface>();
  if (!setup) {
    return emits;
  }
  const sourceFile = ts.createSourceFile(
    'setup.ts',
    setup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter({ removeComments: true });
  const print = (node: ts.Node): string =>
    printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineEmits'
    ) {
      const type = node.typeArguments?.[0];
      for (const member of type && ts.isTypeLiteralNode(type) ? type.members : []) {
        if (ts.isPropertySignature(member) && member.type) {
          // The printer keeps the line breaks of a tuple that the source writes on several lines,
          // so each element of a tuple prints alone.
          emits.set(member.name.getText(sourceFile).replace(/^['"]|['"]$/g, ''), {
            type: ts.isTupleTypeNode(member.type)
              ? `[${member.type.elements.map(print).join(', ')}]`
              : print(member.type),
            description: jsDocText(member),
          });
        } else if (ts.isCallSignatureDeclaration(member)) {
          const [first, ...rest] = member.parameters;
          if (
            first?.type &&
            ts.isLiteralTypeNode(first.type) &&
            ts.isStringLiteral(first.type.literal)
          ) {
            emits.set(first.type.literal.text, {
              type: `[${rest.map(print).join(', ')}]`,
              description: jsDocText(member),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return emits;
}

function compileSetup(source: string, file: string): ReturnType<typeof compileScript> {
  const { descriptor } = parse(source, { filename: file });
  try {
    return compileScript(descriptor, { id: file });
  } catch (error) {
    throw new Error(
      `${file}: the SFC compiler cannot read the props: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** The prop names are the keys that the SFC compiler reports as props. They do not include the native attributes. */
function readPropNames(source: string, file: string): string[] {
  return (
    Object.entries(compileSetup(source, file).bindings ?? {})
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- `vue/compiler-sfc` does not export the enum `BindingTypes`, so the code compares its value.
      .filter(([, type]) => type === 'props')
      .map(([name]) => name)
  );
}

/** The keys of the `props` option of the component that the SFC compiler writes for `<script setup>`. */
function readPropsOption(content: string, file: string): string[] {
  const script = ts.createSourceFile('setup.ts', content, ts.ScriptTarget.Latest);
  const component = script.statements.find(ts.isExportAssignment)?.expression;
  const [options] = component && ts.isCallExpression(component) ? component.arguments : [];
  if (options && ts.isObjectLiteralExpression(options)) {
    const option = options.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'props',
    );
    if (!option) {
      return [];
    }
    // With defaults that are not a literal, the compiler gives the props to `mergeDefaults`.
    let props: ts.Expression | undefined = option.initializer;
    if (
      ts.isCallExpression(props) &&
      ts.isIdentifier(props.expression) &&
      props.expression.text === '_mergeDefaults'
    ) {
      props = props.arguments[0];
    }
    if (props && ts.isObjectLiteralExpression(props)) {
      const names = props.properties.map(({ name }) =>
        name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined,
      );
      if (names.every((name) => name !== undefined)) {
        return names;
      }
    }
  }
  throw new Error(
    `${file}: the script that the SFC compiler writes has no \`props\` option that is a list of props. The check for a hidden prop cannot read it. Declare the props with a type: \`defineProps<Props>()\`.`,
  );
}

/**
 * The props that `readPropNames` does not give. A top-level declaration or an import of `<script>`
 * or `<script setup>` takes the binding of a prop of the same name.
 */
export function readHiddenProps(source: string, file: string): string[] {
  if (!parse(source, { filename: file }).descriptor.scriptSetup) {
    return [];
  }
  const { bindings, content } = compileSetup(source, file);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- `vue/compiler-sfc` does not export the enum `BindingTypes`, so the code compares its value.
  return readPropsOption(content, file).filter((name) => bindings?.[name] !== 'props');
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
  // The flags and the clean-up are those of vue-component-meta, so each text has the form that
  // vue-component-meta gives a prop.
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
  const membersOf = (type: ts.Type): readonly ts.Type[] => (type.isUnion() ? type.types : [type]);
  const nullableTexts = (type: ts.Type): string[] =>
    (
      [
        [ts.TypeFlags.Null, 'null'],
        [ts.TypeFlags.Undefined, 'undefined'],
      ] as const
    ).flatMap(([flag, text]) =>
      membersOf(type).some((member) => member.flags & flag) ? [text] : [],
    );
  const withoutParentheses = (node: ts.TypeNode | undefined): ts.TypeNode | undefined =>
    node && ts.isParenthesizedTypeNode(node) ? withoutParentheses(node.type) : node;
  /** The type node of the one declaration of `symbol`, when it is a property, a parameter or a getter. */
  const declaredTypeNode = (symbol: ts.Symbol): ts.TypeNode | undefined => {
    const [declaration, ...others] = symbol.declarations ?? [];
    return declaration &&
      others.length === 0 &&
      (ts.isPropertySignature(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isParameter(declaration) ||
        ts.isGetAccessorDeclaration(declaration))
      ? declaration.type
      : undefined;
  };
  /** `X['key']` gives the type node of the declaration of the property `key` of `X`. */
  const followPropertyAccess = (node: ts.TypeNode | undefined): ts.TypeNode | undefined => {
    const bare = withoutParentheses(node);
    if (
      !bare ||
      !ts.isIndexedAccessTypeNode(bare) ||
      !ts.isLiteralTypeNode(bare.indexType) ||
      !ts.isStringLiteral(bare.indexType.literal)
    ) {
      return bare;
    }
    const property = typeChecker()
      .getTypeFromTypeNode(bare.objectType)
      .getProperty(bare.indexType.literal.text);
    const target = property && declaredTypeNode(property);
    return target ? followPropertyAccess(target) : bare;
  };

  interface DeclaredUnion {
    /** The text of each member that is not `null` or `undefined`, in the sequence of the declaration. */
    texts: string[];
    /** The members of the union of the checker that the declaration names. */
    covered: Set<ts.Type>;
    /** `null` and `undefined` where a member text already includes them, as the alias `FocusOption` includes `null`. */
    written: Set<string>;
  }

  // The checker keeps one type for each set of members of a union, whatever their sequence in the
  // source. It writes the members in the order in which it made their types, and that order changes
  // with each file that it read before, such as a file of another family. The type node of the
  // declaration keeps the sequence of the source.
  const declaredUnion = (
    type: ts.Type,
    declared: ts.TypeNode | undefined,
  ): DeclaredUnion | undefined => {
    const node = followPropertyAccess(declared);
    if (!node || !type.isUnion()) {
      return undefined;
    }
    const union: DeclaredUnion = { texts: [], covered: new Set(), written: new Set() };
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.KeyOfKeyword) {
      // The checker writes `keyof X` for a type with a name, and else the keys, in its own order.
      if (typeText(type).startsWith('keyof ')) {
        return undefined;
      }
      for (const property of typeChecker().getPropertiesOfType(
        typeChecker().getTypeFromTypeNode(node.type),
      )) {
        const key = typeChecker().getStringLiteralType(property.getName());
        union.texts.push(typeText(key));
        union.covered.add(key);
      }
    } else if (ts.isUnionTypeNode(node) || ts.isTypeLiteralNode(node)) {
      // An optional property adds `undefined` to the type of its type literal.
      for (const member of ts.isUnionTypeNode(node) ? node.types : [node]) {
        const memberType = typeChecker().getTypeFromTypeNode(member);
        const inner = declaredUnion(memberType, member);
        if (inner) {
          union.texts.push(...inner.texts);
          inner.covered.forEach((covered) => union.covered.add(covered));
          inner.written.forEach((text) => union.written.add(text));
          continue;
        }
        for (const covered of membersOf(memberType)) {
          union.covered.add(covered);
        }
        if (!(memberType.flags & NULLABLE)) {
          union.texts.push(memberText(memberType, member));
          nullableTexts(memberType).forEach((text) => union.written.add(text));
        }
      }
    } else {
      return undefined;
    }
    // A declaration in terms of a type parameter, such as `T | null`, does not name the members of
    // the type that the checker gives for an instance.
    const actual = new Set(type.types);
    const same =
      type.types.every((member) => union.covered.has(member) || member.flags & NULLABLE) &&
      [...union.covered].every((member) => actual.has(member) || member.flags & NULLABLE);
    if (!same) {
      return undefined;
    }
    // The checker writes `true` and `false` as one member `boolean`.
    const booleans =
      union.texts.includes('boolean') ||
      (union.texts.includes('true') && union.texts.includes('false'));
    const texts = booleans
      ? union.texts.map((text) => (text === 'true' || text === 'false' ? 'boolean' : text))
      : union.texts;
    return { ...union, texts: [...new Set(texts)] };
  };
  // The checker writes a function, a constructor, a conditional type and an intersection in
  // parentheses when it is a member of a union.
  const memberText = (type: ts.Type, node: ts.TypeNode): string => {
    const text = declaredText(type, node);
    const kind = typeChecker().typeToTypeNode(
      type,
      undefined,
      ts.NodeBuilderFlags.NoTruncation,
    )?.kind;
    return kind === ts.SyntaxKind.FunctionType ||
      kind === ts.SyntaxKind.ConstructorType ||
      kind === ts.SyntaxKind.ConditionalType ||
      kind === ts.SyntaxKind.IntersectionType
      ? `(${text})`
      : text;
  };
  /** The declaration of an anonymous object type, such as the member that an `Extract` gives. */
  const typeLiteralOf = (type: ts.Type): ts.TypeLiteralNode | undefined => {
    if (!(type.flags & ts.TypeFlags.Object)) {
      return undefined;
    }
    const [declaration, ...others] = type.getSymbol()?.declarations ?? [];
    // The checker writes the name of an alias, such as `type Named = { … }`, and not its literal. It
    // gives each `{}` one shared type with no declaration, so `{}` keeps the text of the checker.
    return declaration &&
      others.length === 0 &&
      ts.isTypeLiteralNode(declaration) &&
      typeChecker().typeToTypeNode(type, undefined, ts.NodeBuilderFlags.NoTruncation)?.kind ===
        ts.SyntaxKind.TypeLiteral
      ? declaration
      : undefined;
  };
  // The text of the checker, `{ name: type; }`, with each property type from its declaration. The
  // checker writes a quoted key with the quotes of the source, so such a literal keeps its text.
  const typeLiteralText = (type: ts.Type, literal: ts.TypeLiteralNode): string | undefined => {
    const texts = literal.members.map((member) => {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) {
        return undefined;
      }
      const property = type.getProperty(member.name.text);
      if (!property) {
        return undefined;
      }
      const readonly = member.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ReadonlyKeyword);
      const text = declaredText(typeChecker().getTypeOfSymbol(property), member.type);
      return `${readonly ? 'readonly ' : ''}${property.getName()}${member.questionToken ? '?' : ''}: ${text};`;
    });
    return texts.every((text) => text !== undefined) ? `{ ${texts.join(' ')} }` : undefined;
  };
  /** The text of `type`, as `typeText` writes it, with each union of `declared` in the sequence of the declaration. */
  const declaredText = (type: ts.Type, declared: ts.TypeNode | undefined): string => {
    const union = declaredUnion(type, declared);
    if (union) {
      // The checker writes `null` and then `undefined` after the other members.
      const nullables = nullableTexts(type).filter((text) => !union.written.has(text));
      return [...union.texts, ...nullables].join(' | ');
    }
    const literal = typeLiteralOf(type);
    return (literal && typeLiteralText(type, literal)) ?? typeText(type);
  };
  // The checker names a property with a symbol key `__@iterator@<id>`, and the id changes with each
  // symbol that it read before. `symbolToString` gives the key as the source writes it.
  const propertyName = (property: ts.Symbol): string => {
    // A property of an `Omit` or a `Pick` has the declarations of the property that it copies, but
    // no `valueDeclaration`.
    const [declaration] = property.declarations ?? [];
    const name = declaration && ts.getNameOfDeclaration(declaration);
    return name &&
      ts.isComputedPropertyName(name) &&
      typeChecker().getTypeAtLocation(name.expression).flags & ts.TypeFlags.ESSymbolLike
      ? typeChecker().symbolToString(property)
      : property.getName();
  };
  const symbolTypeText = (symbol: ts.Symbol): string =>
    declaredText(typeChecker().getTypeOfSymbol(symbol), declaredTypeNode(symbol));
  // The checker lists the properties of a mapped type, such as an `Omit`, in the order of its keys,
  // which is the order in which it made their types. Each run of properties that one interface or
  // type literal declares thus takes the sequence of that declaration.
  const inDeclarationOrder = (properties: readonly ts.Symbol[]): ts.Symbol[] => {
    const declarationOf = (property: ts.Symbol): ts.Declaration | undefined =>
      property.declarations?.[0];
    const runs: ts.Symbol[][] = [];
    for (const property of properties) {
      const run = runs.at(-1);
      const previous = run?.at(-1);
      const parent = declarationOf(property)?.parent;
      if (run && previous && parent && declarationOf(previous)?.parent === parent) {
        run.push(property);
      } else {
        runs.push([property]);
      }
    }
    return runs.flatMap((run) =>
      run.sort((a, b) => (declarationOf(a)?.pos ?? 0) - (declarationOf(b)?.pos ?? 0)),
    );
  };
  const expressionPropertyNames = (expression: ts.Expression): string[] => {
    if (ts.isIdentifier(expression)) {
      const declaration = typeChecker().getSymbolAtLocation(expression)?.valueDeclaration;
      // The generated code of an SFC stores the argument of `defineExpose` in a variable.
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
        return expressionPropertyNames(declaration.initializer);
      }
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return expression.properties.flatMap((property) => {
        if (ts.isSpreadAssignment(property)) {
          return expressionPropertyNames(property.expression);
        }
        const symbol = typeChecker().getSymbolAtLocation(property.name);
        return symbol ? [propertyName(symbol)] : [];
      });
    }
    return inDeclarationOrder(
      typeChecker().getPropertiesOfType(typeChecker().getTypeAtLocation(expression)),
    ).map(propertyName);
  };
  const exposeArgument = (file: string): ts.Expression | undefined => {
    const sourceFile = checker.getProgram()?.getSourceFile(file);
    const visit = (node: ts.Node): ts.Expression | undefined => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'defineExpose'
      ) {
        return node.arguments[0];
      }
      return ts.forEachChild(node, visit);
    };
    return sourceFile && visit(sourceFile);
  };
  /**
   * The exposed members in the sequence of `defineExpose`. vue-component-meta leaves out a member
   * that has the name of a prop, such as `validate` of `Field.Root`. The argument of
   * `defineExpose` then gives its type and its text.
   */
  const readExposed = (file: string, listed: readonly (MemberSurface & { name: string })[]) => {
    const exposed = new Map(
      listed.map(({ name, type, description }) => [name, { type, description }]),
    );
    const argument = exposeArgument(file);
    if (!argument) {
      return exposed;
    }
    const argumentType = typeChecker().getTypeAtLocation(argument);
    const fromArgument = (name: string): MemberSurface | undefined => {
      const property = argumentType.getProperty(name);
      return (
        property && {
          type: typeText(typeChecker().getTypeOfSymbol(property)),
          description: documentationOf(property),
        }
      );
    };
    return new Map([
      ...expressionPropertyNames(argument).flatMap((name): [string, MemberSurface][] => {
        const member = exposed.get(name) ?? fromArgument(name);
        return member ? [[name, member]] : [];
      }),
      ...exposed,
    ]);
  };
  // `getJsDocTags` gives a property that an interface declares again with no tag the tags of the
  // declaration in the base interface. The declarations of a property of an `Omit` or a `Pick` are
  // those of the property that it copies, so such a property keeps its tags.
  const ownTags = (symbol: ts.Symbol): ts.JSDocTag[] =>
    (symbol.declarations ?? []).flatMap((declaration) => ts.getJSDocTags(declaration));
  const tagText = (symbol: ts.Symbol, tagName: string): string | undefined => {
    const tag = ownTags(symbol).find((item) => item.tagName.text === tagName);
    return tag && ts.getTextOfJSDocComment(tag.comment);
  };
  const returnTypeOf = (signatures: readonly ts.Signature[]): string => {
    const texts = signatures.map((signature) =>
      declaredText(
        typeChecker().getReturnTypeOfSignature(signature),
        signature.declaration && !ts.isJSDocSignature(signature.declaration)
          ? signature.declaration.type
          : undefined,
      ),
    );
    return [...new Set(texts)].join(' | ');
  };
  const functionOf = (symbol: ts.Symbol): FunctionSurface | undefined => {
    const signatures = typeChecker().getTypeOfSymbol(symbol).getCallSignatures();
    if (signatures.length === 0) {
      return undefined;
    }
    const longest = signatures.reduce((best, signature) =>
      signature.parameters.length > best.parameters.length ? signature : best,
    );
    return {
      description: documentationOf(symbol),
      parameters: longest.parameters.map((parameter, index) => {
        const declaration = parameter.valueDeclaration;
        return {
          name: parameter.getName(),
          type: symbolTypeText(parameter),
          optional:
            (declaration !== undefined &&
              ts.isParameter(declaration) &&
              typeChecker().isOptionalParameter(declaration)) ||
            signatures.some((signature) => signature.parameters.length <= index),
          description: documentationOf(parameter),
        };
      }),
      returns: {
        type: returnTypeOf(signatures),
        description: tagText(symbol, 'returns') ?? '',
      },
    };
  };
  const directExport = (entryFile: string, name: string): ts.Symbol | undefined => {
    const entry = entrySymbol(entryFile);
    return (
      entry &&
      typeChecker()
        .getExportsOfModule(entry)
        .find((symbol) => symbol.getName() === name)
    );
  };
  const exportAt = (entryFile: string, path: string): ts.Symbol | undefined => {
    let module = entrySymbol(entryFile);
    let found: ts.Symbol | undefined;
    for (const name of path.split('.')) {
      if (!module || !(module.flags & ts.SymbolFlags.Module)) {
        return undefined;
      }
      found = typeChecker()
        .getExportsOfModule(module)
        .find((symbol) => symbol.getName() === name);
      module = found && resolve(found);
    }
    return found;
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

  // The props of a component: the `$props` of an instance, or the first parameter of the function
  // that vue-tsc makes for a generic SFC. vue-component-meta reads them from the same places.
  const propsTypeOf = (component: ts.Symbol): ts.Type | undefined => {
    const type = typeChecker().getTypeOfSymbol(resolve(component));
    for (const signature of type.getConstructSignatures()) {
      const props = signature.getReturnType().getProperty('$props');
      if (props) {
        return typeChecker().getTypeOfSymbol(props);
      }
    }
    const [parameter] = type.getCallSignatures().flatMap((signature) => signature.parameters);
    return parameter && typeChecker().getTypeOfSymbol(parameter);
  };

  // The type of the property of the props type is the intersection of the declared type and the
  // listener type that vue-tsc makes from the emit. The declaration keeps the declared type.
  const declaredProp = (component: ts.Symbol, name: string, file: string): PropSurface => {
    const declaration = propsTypeOf(component)
      ?.getProperty(name)
      ?.declarations?.find(
        (node): node is ts.PropertySignature =>
          ts.isPropertySignature(node) && node.name.getText() === name,
      );
    const prop = declaration && typeChecker().getSymbolAtLocation(declaration.name);
    if (!declaration || !prop) {
      throw new Error(`${file}: the props of the component have no declaration of "${name}".`);
    }
    return {
      required: declaration.questionToken === undefined,
      default: null,
      description: documentationOf(prop),
      type: symbolTypeText(prop),
      ignored: ownTags(prop).some(({ tagName }) => tagName.text === 'ignore'),
    };
  };

  const project: VaseProject = {
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
      // vue-component-meta leaves out a prop that has the `on` name of an emit, such as `onFormSubmit`
      // of the emit `formSubmit`. The declaration of such a prop gives its type and its text.
      const listenerProps = new Set(
        meta.events.map(({ name }) => `on${name.charAt(0).toUpperCase()}${name.slice(1)}`),
      );
      const propsType = propsTypeOf(symbol);
      const props = new Map<string, PropSurface>();
      for (const name of readPropNames(source, file)) {
        const prop = documented.get(name);
        if (!prop) {
          if (!listenerProps.has(name)) {
            throw new Error(
              `${file}: the SFC compiler reads the prop "${name}", but vue-component-meta does not list it.`,
            );
          }
          props.set(name, declaredProp(symbol, name, file));
          continue;
        }
        const declaration = propsType?.getProperty(name);
        if (!declaration) {
          throw new Error(`${file}: the props type of the component has no property "${name}".`);
        }
        props.set(name, {
          required: prop.required,
          default: prop.default ?? null,
          description: prop.description,
          // vue-component-meta writes the members of a union in the order of the checker.
          type: symbolTypeText(declaration),
          ignored: prop.tags.some((tag) => tag.name === 'ignore'),
        });
      }
      const declaredEmits = readEmits(source, file);
      const listed = new Set(meta.events.map(({ name }) => name));
      return {
        description: documentationOf(resolve(symbol)),
        props,
        // vue-component-meta lists the events in the order of the keys of a mapped type, which is
        // the order in which the checker made their types. `defineEmits` keeps the sequence of the
        // source.
        emits: new Map([
          ...[...declaredEmits].filter(([name]) => listed.has(name)),
          ...meta.events.flatMap(({ name, type }): [string, MemberSurface][] =>
            declaredEmits.has(name) ? [] : [[name, { type, description: '' }]],
          ),
        ]),
        slots: new Map(
          meta.slots.map((slot) => [
            slot.name,
            {
              description: slot.description,
              props: inDeclarationOrder(
                typeChecker().getPropertiesOfType(slot.getTypeObject()),
              ).map((property) => ({
                name: propertyName(property),
                type: symbolTypeText(property),
              })),
            },
          ]),
        ),
        // vue-component-meta lists the members in the order of the checker. For an object with a
        // spread, the checker lists the parts from the last to the first.
        exposed: readExposed(file, meta.exposed),
      };
    },

    readTags: ({ symbol }) =>
      ownTags(resolve(symbol)).map((tag) => ({
        name: tag.tagName.text,
        text: (ts.getTextOfJSDocComment(tag.comment) ?? '').replace(/\s+/g, ' ').trim(),
      })),

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

    findExportAt(entryFile, path) {
      const symbol = exportAt(entryFile, path);
      return symbol && { path, symbol };
    },

    readUnionValues(entryFile, path) {
      const symbol = exportAt(entryFile, path);
      const declaration = symbol && resolve(symbol).declarations?.find(ts.isTypeAliasDeclaration);
      if (!declaration) {
        return undefined;
      }
      // The checker gives the members of a union in the order in which it made their types. The
      // nodes of the declaration keep the order that the source shows, also through an alias of
      // another union, such as `Calendar.Root.ChangeEventReason`.
      const declaredMembers = (node: ts.TypeNode): readonly ts.Type[] => {
        if (ts.isParenthesizedTypeNode(node)) {
          return declaredMembers(node.type);
        }
        if (ts.isUnionTypeNode(node)) {
          return node.types.flatMap(declaredMembers);
        }
        const target =
          ts.isTypeReferenceNode(node) && !node.typeArguments
            ? typeChecker().getSymbolAtLocation(node.typeName)
            : undefined;
        const alias = target && resolve(target).declarations?.find(ts.isTypeAliasDeclaration);
        return alias && !alias.typeParameters
          ? declaredMembers(alias.type)
          : membersOf(typeChecker().getTypeFromTypeNode(node));
      };
      const members = declaredMembers(declaration.type);
      const values = members.flatMap((member) => (member.isStringLiteral() ? [member.value] : []));
      return values.length === members.length ? [...new Set(values)] : undefined;
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
      return signatures.length === 0 ? undefined : returnTypeOf(signatures);
    },

    readFunction: ({ symbol }) => functionOf(resolve(symbol)),

    readProperties({ symbol }) {
      const resolved = resolve(symbol);
      if (!(resolved.flags & ts.SymbolFlags.Type)) {
        return undefined;
      }
      const type = typeChecker().getDeclaredTypeOfSymbol(resolved);
      // A union of literals has the properties of its apparent type, such as `String`, and an array
      // or a tuple has the properties of `Array`. They are not its own.
      if (
        !(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) ||
        typeChecker().isArrayType(type) ||
        typeChecker().isTupleType(type)
      ) {
        return [];
      }
      return typeChecker()
        .getPropertiesOfType(type)
        .map((property) => ({
          name: propertyName(property),
          type: symbolTypeText(property),
          optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
          default: tagText(property, 'default') ?? null,
          description: documentationOf(property),
        }));
    },

    readClass({ symbol }) {
      const resolved = resolve(symbol);
      if (!(resolved.flags & ts.SymbolFlags.Class)) {
        return undefined;
      }
      const hidden = ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
      const members = typeChecker()
        .getPropertiesOfType(typeChecker().getDeclaredTypeOfSymbol(resolved))
        .filter(
          (member) =>
            !ownTags(member).some(({ tagName }) => tagName.text === 'internal') &&
            (member.declarations ?? []).every((declaration) => {
              // An ECMAScript private member (`#name`) has no modifier.
              const name = ts.getNameOfDeclaration(declaration);
              return (
                (ts.getCombinedModifierFlags(declaration) & hidden) === 0 &&
                !(name && ts.isPrivateIdentifier(name))
              );
            }),
        );
      return {
        properties: members
          .filter((member) => !(member.flags & ts.SymbolFlags.Method))
          .map((property) => ({
            name: propertyName(property),
            type: symbolTypeText(property),
            readonly: (property.declarations ?? []).every(
              (declaration) =>
                ts.isGetAccessorDeclaration(declaration) ||
                (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0,
            ),
            description: documentationOf(property),
          })),
        methods: members.flatMap((member) => {
          const method = member.flags & ts.SymbolFlags.Method ? functionOf(member) : undefined;
          return method ? [{ name: propertyName(member), ...method }] : [];
        }),
      };
    },

    updateFile(path, text) {
      sources.set(path, text);
      checker.updateFile(path, text);
    },
  };

  return project;
}
