import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createVaseProject } from './vaseSurface.ts';
import type { ExportMatch } from './vaseSurface.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SAMPLE = join(FIXTURES, 'packages/vue/src/sample');
const ENTRY = join(SAMPLE, 'index.ts');
const PARTS = join(SAMPLE, 'index.parts.ts');
const ROOT = join(SAMPLE, 'root/SampleRoot.vue');

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
function withText<T>(path: string, from: string, to: string, run: () => T): T {
  const original = readFileSync(path, 'utf8');
  assert.equal(
    original.includes(from),
    true,
    `The seed does not apply. This text is not in ${path}:\n${from}`,
  );
  project.updateFile(path, original.replace(from, to));
  try {
    return run();
  } finally {
    project.updateFile(path, original);
  }
}

const withParts = <T>(from: string, to: string, run: () => T): T => withText(PARTS, from, to, run);

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
    "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';",
    "export type SampleRootChangeEventReason = 'trigger-press' | 'escape-key' | 'none';\nexport type SampleRootOpenEventReason = 'none' | 'escape-key' | 'trigger-press';",
    () =>
      ['SampleRootChangeEventReason', 'SampleRootOpenEventReason'].map((name) =>
        project.readUnionValues(ENTRY, name),
      ),
  );
  assert.deepEqual(changeReason, ['trigger-press', 'escape-key', 'none']);
  assert.deepEqual(openReason, ['none', 'escape-key', 'trigger-press']);
});

test('a class has its public properties and methods, in the sequence of the declaration', () => {
  const handle = withParts(
    HANDLE,
    [
      'class PopupHandle {',
      '  protected readonly fallback = 0;',
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

test('a union of literals has no property, although its apparent type has some', () => {
  const properties = withParts(HANDLE, `export type Side = 'top' | 'bottom';\n\n${HANDLE}`, () =>
    project.readProperties(exportOf('Side')),
  );
  assert.deepEqual(properties, []);
});

test('a prop that has the name of the listener of an emit has no metadata, because vue-component-meta leaves it out', () => {
  const props = withText(
    ROOT,
    OPEN_PROP,
    `${OPEN_PROP}\n  onOpenChangeComplete?: ((open: boolean) => void) | undefined;`,
    () => project.readComponent(exportOf('Root'))?.props,
  );
  assert.deepEqual(props?.get('onOpenChangeComplete'), {
    required: false,
    default: null,
    description: '',
    type: '',
  });
});

test('a prop that the SFC compiler reads and vue-component-meta lists under another name is an error', () => {
  assert.throws(
    () =>
      withText(ROOT, OPEN_PROP, `${OPEN_PROP}\n  onVnodeMounted?: (() => void) | undefined;`, () =>
        project.readComponent(exportOf('Root')),
      ),
    /the SFC compiler reads the prop "onVnodeMounted", but vue-component-meta does not list it/,
  );
});
