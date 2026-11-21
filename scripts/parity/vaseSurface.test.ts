import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createVaseProject, readHiddenProps } from './vaseSurface.ts';
import type { ExportMatch } from './vaseSurface.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SAMPLE = join(FIXTURES, 'packages/vue/src/sample');
const ENTRY = join(SAMPLE, 'index.ts');
const PARTS = join(SAMPLE, 'index.parts.ts');
const ROOT = join(SAMPLE, 'root/SampleRoot.vue');
const POPUP = join(SAMPLE, 'popup/SamplePopup.vue');

const CREATE_HANDLE = 'export function createHandle(): Handle {';
const HANDLE = 'export interface Handle {\n  open: () => void;\n  close: () => void;\n}';
const OPEN_PROP = '  open?: boolean | undefined;';

const project = createVaseProject(join(FIXTURES, 'tsconfig.json'));

function exportOf(name: string): ExportMatch {
  const [match] = project.findExports(ENTRY, name);
  assert.notEqual(match, undefined, `The fixture has no export ${name}.`);
  return match;
}

/** Changes the text of a fixture file in memory for the time of `run`. The text is put back after it. */
function withText<T>(path: string, edits: readonly (readonly [string, string])[], run: () => T): T {
  const original = readFileSync(path, 'utf8');
  let edited = original;
  for (const [from, to] of edits) {
    assert.equal(
      edited.includes(from),
      true,
      `The seed does not apply. This text is not in ${path}:\n${from}`,
    );
    edited = edited.replace(from, to);
  }
  project.updateFile(path, edited);
  try {
    return run();
  } finally {
    project.updateFile(path, original);
  }
}

const withParts = <T>(from: string, to: string, run: () => T): T =>
  withText(PARTS, [[from, to]], run);

const readCreateHandle = () => project.readFunction(exportOf('createHandle'));

test('a function has the JSDoc of its export, its parameters and its return value', () => {
  assert.deepEqual(readCreateHandle(), {
    description: '',
    parameters: [],
    returns: { type: 'Handle', description: '' },
  });

  const documented = withParts(
    CREATE_HANDLE,
    [
      '/**',
      ' * Creates a handle for a sample.',
      ' * @param name The name of the sample.',
      ' * @param duration How long the sample stays open.',
      ' * @returns The new handle.',
      ' */',
      'export function createHandle(name: string, duration: number = 300, label?: string): Handle {',
    ].join('\n'),
    readCreateHandle,
  );
  assert.deepEqual(documented, {
    description: 'Creates a handle for a sample.',
    parameters: [
      { name: 'name', type: 'string', optional: false, description: 'The name of the sample.' },
      {
        name: 'duration',
        type: 'number',
        optional: true,
        description: 'How long the sample stays open.',
      },
      { name: 'label', type: 'string | undefined', optional: true, description: '' },
    ],
    returns: { type: 'Handle', description: 'The new handle.' },
  });
});

test('a function with overloads has the parameters of its longest signature, and a parameter that a shorter signature lacks is optional', () => {
  const overloaded = withParts(
    CREATE_HANDLE,
    [
      'export function createHandle(name: string): Handle;',
      'export function createHandle(name: string, size: number, label: string): Handle;',
      'export function createHandle(name: string, size: number): Handle;',
      'export function createHandle(..._arguments: unknown[]): Handle {',
    ].join('\n'),
    readCreateHandle,
  );
  assert.deepEqual(
    overloaded?.parameters.map(({ name, type, optional }) => [name, type, optional]),
    [
      ['name', 'string', false],
      ['size', 'number', true],
      ['label', 'string', true],
    ],
  );
});

test('an export with no call signature is not a function', () => {
  assert.equal(project.readFunction(exportOf('Handle')), undefined);
  assert.equal(project.readFunction(exportOf('Popup')), undefined);
});

test('a type has its properties with type, optional mark, default and description', () => {
  const documented = withParts(
    HANDLE,
    [
      'export interface Handle {',
      '  /** Opens the sample. */',
      '  open: () => void;',
      '  /**',
      '   * How long the sample stays open, in milliseconds.',
      '   * @default 300',
      '   */',
      '  duration?: number | undefined;',
      '  close: () => void;',
      '}',
    ].join('\n'),
    () => project.readProperties(exportOf('Handle')),
  );
  assert.deepEqual(documented, [
    {
      name: 'open',
      type: '() => void',
      optional: false,
      default: null,
      description: 'Opens the sample.',
    },
    {
      name: 'duration',
      type: 'number | undefined',
      optional: true,
      default: '300',
      description: 'How long the sample stays open, in milliseconds.',
    },
    { name: 'close', type: '() => void', optional: false, default: null, description: '' },
  ]);
});

test('a property has the tags of its own declaration, and a property of an Omit has the tags of the property that it copies', () => {
  const read = (name: string) =>
    withParts(
      HANDLE,
      [
        'export interface Placement {',
        '  /** @default 600 */',
        '  delay?: number | undefined;',
        "  /** @default 'horizontal' */",
        '  orientation?: string | undefined;',
        '}',
        'export interface SeparatorPlacement extends Placement {',
        '  /** The opposite of the orientation of the toolbar. */',
        '  orientation?: string | undefined;',
        '}',
        "export type DelayPlacement = Omit<Placement, 'orientation'>;",
        HANDLE,
      ].join('\n'),
      () => project.readProperties(exportOf(name)),
    )?.map(({ name: property, default: text }) => [property, text]);
  assert.deepEqual(read('SeparatorPlacement'), [
    ['orientation', null],
    ['delay', '600'],
  ]);
  assert.deepEqual(read('DelayPlacement'), [['delay', '600']]);
});

test('a union of strings has its values in the sequence of its declaration', () => {
  const [changeReason, openReason] = withText(
    ROOT,
    [
      [
        "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';",
        "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';\nexport type SampleRootOpenEventReason = 'none' | 'escape-key' | 'trigger-press';",
      ],
    ],
    () =>
      ['SampleRootChangeEventReason', 'SampleRootOpenEventReason'].map((name) =>
        project.readUnionValues(ENTRY, name),
      ),
  );
  assert.deepEqual(changeReason, ['trigger-press', 'escape-key', 'none']);
  assert.deepEqual(openReason, ['none', 'escape-key', 'trigger-press']);
});

test('a union of strings that names another union has the values of that declaration, in its sequence', () => {
  const values = withText(
    ROOT,
    [
      [
        "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';",
        "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';\nexport type SampleRootReversedReason = 'none' | 'escape-key' | 'trigger-press';\nexport type SampleRootCloseEventReason = SampleRootChangeEventReason;",
      ],
    ],
    // The reversed union is read first, so the checker makes its strings in the reverse sequence.
    () =>
      ['SampleRootReversedReason', 'SampleRootCloseEventReason'].map((name) =>
        project.readUnionValues(ENTRY, name),
      ),
  );
  assert.deepEqual(values, [
    ['none', 'escape-key', 'trigger-press'],
    ['trigger-press', 'escape-key', 'none'],
  ]);
});

const SEQUENCE = [
  "export type Seed = 'second' | 'first';",
  "type Segment = { kind: 'first' | 'second'; editable: false } | { kind: 'other'; editable: true };",
  "type Maybe = 'first' | undefined;",
  'export interface Keys {\n  first: string;\n  second: string;\n}',
  'export interface Sequence {',
  "  union: 'first' | 'second' | undefined;",
  "  access: Sequence['union'];",
  '  keys: keyof Keys;',
  '  literalKeys: keyof { first: string; second: string };',
  '  optionalKeys?: keyof { first: string; second: string };',
  '  segment: Extract<Segment, { editable: false }>;',
  "  options?: { readonly kind?: 'first' | 'second' };",
  '  listener?: ((kind: string) => void) | null;',
  "  held: Maybe | 'second';",
  '}',
].join('\n');

test('a type text writes the members of each union in the sequence of the declaration, and not in the sequence of the checker', () => {
  const properties = withParts(HANDLE, `${SEQUENCE}\n\n${HANDLE}`, () => {
    // The checker makes "second" before "first" when it reads `Seed` first.
    project.readUnionValues(ENTRY, 'Sample.Seed');
    return project.readProperties(exportOf('Sequence'));
  });
  assert.deepEqual(
    properties?.map(({ name, type }) => [name, type]),
    [
      ['union', '"first" | "second" | undefined'],
      ['access', '"first" | "second" | undefined'],
      ['keys', 'keyof Keys'],
      ['literalKeys', '"first" | "second"'],
      ['optionalKeys', '"first" | "second" | undefined'],
      ['segment', '{ kind: "first" | "second"; editable: false; }'],
      ['options', '{ readonly kind?: "first" | "second" | undefined; } | undefined'],
      ['listener', '((kind: string) => void) | null | undefined'],
      ['held', 'Maybe | "second"'],
    ],
  );
});

const FORM = [
  'type Named = { first: string };',
  'export interface Form {',
  '  named: Named;',
  "  quoted: { 'data-first': string };",
  '  method: { open(): void };',
  '  empty: {};',
  "  flag: true | 'second' | false;",
  "  absorbed: string | 'second' | null;",
  '}',
].join('\n');

test('a type text keeps each other form of the checker: an alias of a type literal, a quoted key, a method, an empty type literal, boolean and a literal that a wider member covers', () => {
  const properties = withParts(HANDLE, `${FORM}\n\n${HANDLE}`, () =>
    project.readProperties(exportOf('Form')),
  );
  assert.deepEqual(
    properties?.map(({ name, type }) => [name, type]),
    [
      ['named', 'Named'],
      ['quoted', "{ 'data-first': string; }"],
      ['method', '{ open(): void; }'],
      ['empty', '{}'],
      ['flag', 'boolean | "second"'],
      ['absorbed', 'string | null'],
    ],
  );
});

test('a union that names a type parameter keeps the text of the checker for the type argument', () => {
  const properties = withParts(
    HANDLE,
    `interface Box<T> {\n  value: T | null;\n}\nexport interface FirstBox extends Box<'first'> {}\n\n${HANDLE}`,
    () => project.readProperties(exportOf('FirstBox')),
  );
  assert.deepEqual(
    properties?.map(({ name, type }) => [name, type]),
    [['value', '"first" | null']],
  );
});

test('a parameter, a return value and a class property write a union in the sequence of the declaration', () => {
  const code = [
    "export type CodeSeed = 'second' | 'first';",
    "export function pick(side: 'first' | 'second'): 'first' | 'second' {\n  return side;\n}",
    "export class Picker {\n  side: 'first' | 'second' = 'first';\n}",
  ].join('\n');
  const texts = withParts(HANDLE, `${code}\n\n${HANDLE}`, () => {
    project.readUnionValues(ENTRY, 'Sample.CodeSeed');
    const pick = project.readFunction(exportOf('pick'));
    const picker = project.readClass(exportOf('Picker'));
    return [pick?.parameters[0]?.type, pick?.returns.type, picker?.properties[0]?.type];
  });
  assert.deepEqual(texts, ['"first" | "second"', '"first" | "second"', '"first" | "second"']);
});

test('the export at a path can be in a namespace of a namespace, and a union of strings in a namespace has its values', () => {
  const read = withParts(
    CREATE_HANDLE,
    `export type Reason = 'open' | 'close';\n\n${CREATE_HANDLE}`,
    () => ({
      props: project.findExportAt(ENTRY, 'Sample.Root.Props')?.path,
      reason: project.findExportAt(ENTRY, 'Sample.Reason')?.path,
      values: project.readUnionValues(ENTRY, 'Sample.Reason'),
      missing: ['Sample.Root.Ghost', 'Sample.createHandle.Ghost', 'SampleRoot.Props'].map((path) =>
        project.findExportAt(ENTRY, path),
      ),
    }),
  );
  assert.deepEqual(read, {
    props: 'Sample.Root.Props',
    reason: 'Sample.Reason',
    values: ['open', 'close'],
    missing: [undefined, undefined, undefined],
  });
});

test('a class has its public properties and methods, in the sequence of the declaration', () => {
  const handle = withParts(
    HANDLE,
    [
      'class PopupHandle {',
      '  protected readonly fallback = 0;',
      '  readonly #stores: number[] = [];',
      '  get #newest(): number | undefined {',
      '    return this.#stores.at(-1);',
      '  }',
      '  #detach(): void {}',
      '  /** @internal */',
      '  attach(): void {}',
      '  /** Whether the sample is open. */',
      '  get isOpen(): boolean {',
      '    return false;',
      '  }',
      '}',
      'export class Handle extends PopupHandle {',
      "  private readonly componentName = 'Sample';",
      '  /** The label of the trigger. */',
      "  label = 'Open';",
      '  /**',
      '   * Opens the sample.',
      '   * @param triggerId The id of the trigger.',
      '   */',
      '  open(triggerId: string): void {}',
      '  close(): void {}',
      '}',
    ].join('\n'),
    () => project.readClass(exportOf('Handle')),
  );
  assert.deepEqual(handle, {
    properties: [
      { name: 'label', type: 'string', readonly: false, description: 'The label of the trigger.' },
      {
        name: 'isOpen',
        type: 'boolean',
        readonly: true,
        description: 'Whether the sample is open.',
      },
    ],
    methods: [
      {
        name: 'open',
        description: 'Opens the sample.',
        parameters: [
          {
            name: 'triggerId',
            type: 'string',
            optional: false,
            description: 'The id of the trigger.',
          },
        ],
        returns: { type: 'void', description: '' },
      },
      {
        name: 'close',
        description: '',
        parameters: [],
        returns: { type: 'void', description: '' },
      },
    ],
  });
  assert.equal(project.readClass(exportOf('Handle')), undefined);
  assert.equal(project.readClass(exportOf('createHandle')), undefined);
});

test('an export that is not a type has no properties', () => {
  assert.equal(project.readProperties(exportOf('createHandle')), undefined);
  assert.equal(project.readProperties(exportOf('Popup')), undefined);
});

test('an array and a tuple have no property, although their apparent type has some', () => {
  const properties = withParts(
    HANDLE,
    `export type List = string[];\nexport type Pair = [string, number];\n\n${HANDLE}`,
    () => ['List', 'Pair'].map((name) => project.readProperties(exportOf(name))),
  );
  assert.deepEqual(properties, [[], []]);
});

test('a property with a symbol key has the name that the source writes', () => {
  const names = withParts(
    HANDLE,
    `export interface Bag {\n  [Symbol.iterator](): Iterator<string>;\n  size: number;\n}\nexport type Copied = Omit<Bag, 'size'>;\n\n${HANDLE}`,
    () =>
      ['Bag', 'Copied'].map((type) =>
        project.readProperties(exportOf(type))?.map(({ name }) => name),
      ),
  );
  assert.deepEqual(names, [['size', '[Symbol.iterator]'], ['[Symbol.iterator]']]);
});

test('a union of literals has no property, although its apparent type has some', () => {
  const properties = withParts(HANDLE, `export type Side = 'top' | 'bottom';\n\n${HANDLE}`, () =>
    project.readProperties(exportOf('Side')),
  );
  assert.deepEqual(properties, []);
});

const LISTENER_TYPE = '((open: boolean) => void) | ((open: boolean) => void)[] | undefined';
const LISTENER_PROP = `  /** The listener of the \`openChangeComplete\` emit. */\n  onOpenChangeComplete?: ${LISTENER_TYPE};`;

// vue-component-meta leaves out a prop that has the name of the listener of an emit.
for (const { kind, file, edits, part } of [
  {
    kind: 'a generic SFC',
    file: ROOT,
    edits: [[OPEN_PROP, `${OPEN_PROP}\n${LISTENER_PROP}`]],
    part: 'Root',
  },
  {
    kind: 'an SFC with no type parameter',
    file: POPUP,
    edits: [
      ['  disabled?: boolean | undefined;', `  disabled?: boolean | undefined;\n${LISTENER_PROP}`],
      [
        'const attrs = useAttrs();',
        'defineEmits<{\n  openChangeComplete: [open: boolean];\n}>();\n\nconst attrs = useAttrs();',
      ],
    ],
    part: 'Popup',
  },
] as const) {
  test(`a prop of ${kind} that has the name of the listener of an emit has the type and the JSDoc of its declaration`, () => {
    const props = withText(file, edits, () => project.readComponent(exportOf(part))?.props);
    assert.deepEqual(props?.get('onOpenChangeComplete'), {
      required: false,
      default: null,
      description: 'The listener of the `openChangeComplete` emit.',
      type: LISTENER_TYPE,
      ignored: false,
    });
  });
}

test('a prop that has the name of the listener of an emit is ignored when its JSDoc has the tag @ignore', () => {
  const props = withText(
    ROOT,
    [
      [
        OPEN_PROP,
        `${OPEN_PROP}\n  /**\n   * The listener of the \`openChangeComplete\` emit.\n   * @ignore\n   */\n  onOpenChangeComplete?: ${LISTENER_TYPE};`,
      ],
    ],
    () => project.readComponent(exportOf('Root'))?.props,
  );
  assert.equal(props?.get('onOpenChangeComplete')?.ignored, true);
});

test('a prop that the SFC compiler reads and vue-component-meta lists under another name is an error', () => {
  assert.throws(
    () =>
      withText(
        ROOT,
        [[OPEN_PROP, `${OPEN_PROP}\n  onVnodeMounted?: (() => void) | undefined;`]],
        () => project.readComponent(exportOf('Root')),
      ),
    /the SFC compiler reads the prop "onVnodeMounted", but vue-component-meta does not list it/,
  );
});

const sfc = (setup: string, script = ''): string =>
  `${script}<script setup lang="ts">\n${setup}\n</script>\n\n<template>\n  <slot />\n</template>\n`;
// The compiler writes the key `data-state` as a string literal, and the reader must read it too.
const OPEN_PROPS =
  "defineProps<{ open?: boolean | undefined; side?: string | undefined; label?: string | undefined; 'data-state'?: string | undefined }>()";
const HIDDEN_FILE = join(SAMPLE, 'Hidden.vue');

test('a prop is hidden when a script block declares or imports its name, and no other prop is', () => {
  assert.deepEqual(readHiddenProps(sfc(`const props = ${OPEN_PROPS};`), HIDDEN_FILE), []);
  assert.deepEqual(
    readHiddenProps(
      sfc(
        `import { computed, ref as side } from 'vue';\nconst props = ${OPEN_PROPS};\nconst open = computed(() => props.open === true);`,
        '<script lang="ts">\nexport const label = \'Open\';\n</script>\n\n',
      ),
      HIDDEN_FILE,
    ),
    ['open', 'side', 'label'],
  );
});

test('a prop of an SFC whose defaults are not a literal is hidden in the same way', () => {
  const script = '<script lang="ts">\nconst DEFAULTS = { open: false };\n</script>\n\n';
  const props = `const props = withDefaults(${OPEN_PROPS}, DEFAULTS);`;
  assert.deepEqual(readHiddenProps(sfc(props, script), HIDDEN_FILE), []);
  assert.deepEqual(
    readHiddenProps(sfc(`${props}\nconst side = props.side ?? 'top';`, script), HIDDEN_FILE),
    ['side'],
  );
});

test('an SFC with no `<script setup>` has no hidden prop', () => {
  assert.deepEqual(
    readHiddenProps(
      '<script lang="ts">\nconst open = true;\nexport default { props: { open: Boolean }, data: () => ({ open }) };\n</script>\n',
      HIDDEN_FILE,
    ),
    [],
  );
});

test('a `props` option that the check cannot read is an error that names the file', () => {
  const script = '<script lang="ts">\nconst DECLARED = { open: Boolean };\n</script>\n\n';
  for (const declaration of [
    'defineProps(DECLARED)',
    'defineProps({ ...DECLARED })',
    'defineProps({ [Object.keys(DECLARED)[0]]: Boolean })',
    'defineProps(Object.assign({ open: Boolean }, DECLARED))',
    "defineProps(['open'])",
  ]) {
    assert.throws(
      () => readHiddenProps(sfc(`${declaration};`, script), HIDDEN_FILE),
      /Hidden\.vue: the script that the SFC compiler writes has no `props` option that is a list of props/,
      declaration,
    );
  }
});

for (const { kind, file, part, exposed } of [
  { kind: 'a generic SFC', file: ROOT, part: 'Root', exposed: '{ close, unmount }' },
  { kind: 'an SFC with no type parameter', file: POPUP, part: 'Popup', exposed: '{ element }' },
]) {
  for (const { form, declaration } of [
    {
      form: 'an object literal',
      declaration: 'defineExpose({ active: true, ...actions, inputElement });',
    },
    {
      form: 'a variable that holds an object literal',
      declaration:
        'const exposed = { active: true, ...actions, inputElement };\ndefineExpose(exposed);',
    },
  ]) {
    test(`the exposed members of ${kind} keep the sequence of ${form}, with the members of a spread at its place`, () => {
      const members = withText(
        file,
        [
          [
            `defineExpose(${exposed});`,
            `
interface Actions {
  /** Removes the popup. */
  unmount: () => void;
  /** Closes the popup. */
  close: () => void;
}
function useActions(): Actions {
  return { unmount() {}, close() {} };
}
const actions = useActions();
const inputElement = ref<HTMLInputElement | null>(null);
${declaration}`,
          ],
        ],
        () => project.readComponent(exportOf(part))?.exposed,
      );
      assert.deepEqual(members && [...members], [
        ['active', { type: 'boolean', description: '' }],
        ['unmount', { type: '() => void', description: 'Removes the popup.' }],
        ['close', { type: '() => void', description: 'Closes the popup.' }],
        ['inputElement', { type: 'HTMLInputElement | null', description: '' }],
      ]);
    });
  }
}

test('an exposed member with the name of a prop keeps its place, its type and its text', () => {
  const members = withText(
    POPUP,
    [
      [
        'defineExpose({ element });',
        'function disable() {}\ndefineExpose({\n  /** Disables the popup. */\n  disabled: disable,\n  element,\n});',
      ],
    ],
    () => project.readComponent(exportOf('Popup'))?.exposed,
  );
  assert.deepEqual(members && [...members], [
    ['disabled', { type: '() => void', description: 'Disables the popup.' }],
    ['element', { type: 'Element | null', description: '' }],
  ]);
});

test('the exposed members of a spread keep the sequence of their declaration, also the properties that an Omit copies', () => {
  const members = withText(
    POPUP,
    [
      [
        'export interface SamplePopupState {',
        "export type ActionSeed = 'close' | 'unmount';\n\ninterface PopupActions {\n  unmount: () => void;\n  close: () => void;\n  open: () => void;\n}\n\nexport type SamplePopupActions = Omit<PopupActions, 'open'>;\n\nexport interface SamplePopupState {",
      ],
      [
        'defineExpose({ element });',
        'function useActions(): SamplePopupActions {\n  return { unmount() {}, close() {} };\n}\nconst actions = useActions();\ndefineExpose({ element, ...actions });',
      ],
    ],
    () => {
      // The checker makes the keys in the reverse sequence when it reads the seed first.
      project.readUnionValues(ENTRY, 'ActionSeed');
      return project.readComponent(exportOf('Popup'))?.exposed;
    },
  );
  assert.deepEqual([...(members?.keys() ?? [])], ['element', 'unmount', 'close']);
});
