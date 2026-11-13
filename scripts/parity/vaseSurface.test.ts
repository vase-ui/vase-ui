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
