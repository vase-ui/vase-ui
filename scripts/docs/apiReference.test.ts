import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTypesMd } from '../parity/typesMd.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { createVaseProject } from '../parity/vaseSurface.ts';
import {
  buildApiFunctions,
  buildApiParts,
  buildApiTypes,
  createApiReferenceReader,
} from './apiReference.ts';
import { listFamilyPages } from './familyPages.ts';

const FIXTURES = join(import.meta.dirname, '..', 'parity', 'fixtures');
const SAMPLE = join(FIXTURES, 'packages/vue/src/sample');
const ENTRY = join(SAMPLE, 'index.ts');
const PARTS = join(SAMPLE, 'index.parts.ts');
const POPUP = join(SAMPLE, 'popup/SamplePopup.vue');
const DATA_ATTRIBUTES = join(SAMPLE, 'popup/SamplePopupDataAttributes.ts');
const CSS_VARIABLES = join(SAMPLE, 'popup/SamplePopupCssVariables.ts');

const project = createVaseProject(join(FIXTURES, 'tsconfig.json'));
const types = readTypesMd(
  'docs/src/app/(docs)/react/components/sample/types.md',
  readFileSync(join(FIXTURES, 'sample.types.md'), 'utf8'),
);

/** Gives the project another text for each file for the time of `run`. The texts are put back after it. */
function withTexts<T>(edits: [path: string, from: string, to: string][], run: () => T): T {
  const originals = edits.map(([path, from, to]) => {
    const original = readFileSync(path, 'utf8');
    assert.equal(original.includes(from), true, `The seed does not apply to ${path}:\n${from}`);
    project.updateFile(path, original.replace(from, to));
    return [path, original] as const;
  });
  try {
    return run();
  } finally {
    for (const [path, original] of originals) {
      project.updateFile(path, original);
    }
  }
}

function part(name: string, file = types) {
  const found = buildApiParts(project, ENTRY, file).find((item) => item.name === name);
  assert.notEqual(found, undefined, `The reference has no part ${name}.`);
  return found!;
}

test('a prop has its type, documented default, required mark and description, and the shared props come last', () => {
  const { props } = withTexts(
    [
      [
        POPUP,
        '/** Which side of the trigger the popup uses. */',
        "/**\n   * Which side of the trigger the popup uses.\n   * @default 'bottom'\n   */",
      ],
    ],
    () => part('Sample.Popup'),
  );
  assert.deepEqual(
    props.map(({ name }) => name),
    ['disabled', 'keepMounted', 'name', 'side', 'stateClass', 'stateStyle', 'as'],
  );
  assert.deepEqual(
    props.find(({ name }) => name === 'name'),
    {
      name: 'name',
      type: 'string',
      default: null,
      required: true,
      description: 'The name of the popup.',
    },
  );
  assert.deepEqual(
    props.find(({ name }) => name === 'side'),
    {
      name: 'side',
      type: '"bottom" | "top" | undefined',
      default: "'bottom'",
      required: false,
      description: 'Which side of the trigger the popup uses.',
    },
  );
  // The default of Vue is `false`, but the JSDoc has no `@default` tag.
  assert.equal(props.find(({ name }) => name === 'keepMounted')?.default, null);
});

test('an event has its arguments and the text of its JSDoc', () => {
  assert.deepEqual(part('Sample.Root').events, [
    {
      name: 'openChange',
      type: '[open: boolean, details: SampleRootChangeEventDetails]',
      description: 'Fires first, with the details. A listener can cancel the change.',
    },
    {
      name: 'update:open',
      type: '[open: boolean]',
      description: 'Fires second, unless the details cancel the change.',
    },
    {
      name: 'openChangeComplete',
      type: '[open: boolean]',
      description: 'Fires after the animations of the change end.',
    },
  ]);
});

test('a slot has its slot props', () => {
  assert.deepEqual(part('Sample.Popup').slots, [
    { name: 'default', description: '', props: [{ name: 'state', type: 'SamplePopupState' }] },
    {
      name: 'render',
      description: '',
      props: [
        { name: 'props', type: 'Record<string, unknown>' },
        { name: 'state', type: 'SamplePopupState' },
      ],
    },
  ]);
  assert.deepEqual(part('Sample.Root').slots, [
    {
      name: 'default',
      description: '',
      props: [{ name: 'payload', type: 'Payload | undefined' }],
    },
  ]);
});

test('an exposed member has its type', () => {
  assert.deepEqual(part('Sample.Root').exposed, [
    { name: 'close', type: '() => void', description: '' },
    { name: 'unmount', type: '() => void', description: '' },
  ]);
  assert.deepEqual(part('Sample.Popup').exposed, [
    { name: 'element', type: 'Element | null', description: '' },
  ]);
});

test('a data attribute and a CSS variable have the value of the constant as name, with type and description', () => {
  const { dataAttributes, cssVariables } = part('Sample.Popup');
  assert.deepEqual(dataAttributes, [
    { name: 'data-open', type: null, description: '' },
    { name: 'data-closed', type: null, description: '' },
  ]);
  assert.deepEqual(cssVariables, [{ name: '--popup-width', type: null, description: '' }]);

  const documented = withTexts(
    [
      [
        DATA_ATTRIBUTES,
        "export const open = 'data-open';",
        "/**\n * Present when the sample is open.\n * @type {'true' | 'false'}\n */\nexport const open = 'data-open';",
      ],
      [
        CSS_VARIABLES,
        "export const popupWidth = '--popup-width';",
        "/**\n * The width of the popup.\n * @type {number}\n */\nexport const popupWidth = '--popup-width';",
      ],
    ],
    () => part('Sample.Popup'),
  );
  assert.deepEqual(documented.dataAttributes[0], {
    name: 'data-open',
    type: "'true' | 'false'",
    description: 'Present when the sample is open.',
  });
  assert.deepEqual(documented.cssVariables, [
    { name: '--popup-width', type: 'number', description: 'The width of the popup.' },
  ]);
});

test('a part with the children slot prop of its render slot has children', () => {
  assert.equal(part('Sample.Popup').hasChildren, false);
  assert.equal(part('Sample.Root').hasChildren, false);
  const withChildren = withTexts(
    [
      [
        POPUP,
        'render(props: { props: Record<string, unknown>; state: SamplePopupState }): unknown;',
        'render(props: {\n    props: Record<string, unknown>;\n    state: SamplePopupState;\n    children: Component;\n  }): unknown;',
      ],
    ],
    () => part('Sample.Popup'),
  );
  assert.equal(withChildren.hasChildren, true);
});

test('the description of a part is the JSDoc of its export', () => {
  const described = withTexts(
    [
      [
        join(SAMPLE, 'index.parts.ts'),
        'export const Popup: typeof SamplePopup = SamplePopup;',
        '/** A container for the content of the sample. */\nexport const Popup: typeof SamplePopup = SamplePopup;',
      ],
    ],
    () => part('Sample.Popup'),
  );
  assert.equal(described.description, 'A container for the content of the sample.');
  assert.equal(part('Sample.Popup').description, '');
});

test('the parts keep the sequence of the file, and a part with no export or no component is left out', () => {
  const [root, popup] = types.parts;
  const file = {
    ...types,
    parts: [{ ...root, name: 'Ghost' }, root, { ...root, name: 'createHandle' }, popup],
  };
  assert.deepEqual(
    buildApiParts(project, ENTRY, file).map(({ name }) => name),
    ['Sample.Root', 'Sample.Popup'],
  );
});

const CREATE_HANDLE = 'export function createHandle(): Handle {';

test('the functions are the parts and then the functions of the types.md that have a call signature, with the path of the export as name', () => {
  const [root, popup] = types.parts;
  const [createHandle] = types.functions;
  const file = {
    ...types,
    parts: [{ ...root, name: 'closeHandle' }, root, { ...root, name: 'Ghost' }, popup],
    functions: [{ ...createHandle, name: 'Handle' }, createHandle],
  };
  const names = withTexts(
    [[PARTS, CREATE_HANDLE, `export function closeHandle(): void {}\n\n${CREATE_HANDLE}`]],
    () => buildApiFunctions(project, ENTRY, file).map(({ name }) => name),
  );
  assert.deepEqual(names, ['Sample.closeHandle', 'Sample.createHandle']);
});

test('the types are the types and then the additional types of the types.md that have one property or more or are a union of strings, with the path of the export as name, the properties in the sequence of their names and the values in the sequence of the alphabet', () => {
  const file = {
    ...types,
    types: [
      { name: 'SampleRootState', code: '' },
      { name: 'Ghost', code: '' },
      { name: 'Ghost.Handle', code: '' },
      { name: 'Sample.Handle', code: '' },
    ],
    additionalTypes: [
      { name: 'SampleRootChangeEventReason', code: '' },
      { name: 'SamplePopupDataAttributes', code: '' },
      { name: 'SampleRootChangeEventDetails', code: '' },
    ],
  };
  assert.deepEqual(
    buildApiTypes(project, ENTRY, file).map(({ name, properties, values }) => [
      name,
      properties.map((property) => property.name),
      values,
    ]),
    [
      ['Sample.Handle', ['close', 'open'], []],
      ['SampleRootChangeEventReason', [], ['escape-key', 'none', 'trigger-press']],
      ['SampleRootChangeEventDetails', ['cancel', 'event', 'isCanceled', 'reason'], []],
    ],
  );
});

const read = createApiReferenceReader(REPOSITORY_ROOT);

test('each family page has an API reference with one part, function or type or more', () => {
  const pages = listFamilyPages(join(REPOSITORY_ROOT, 'docs'));
  assert.notEqual(pages.length, 0);
  for (const { family } of pages) {
    const { parts, functions, types } = read(family);
    assert.notEqual(
      parts.length + functions.length + types.length,
      0,
      `The API reference of ${family} has no part, function or type.`,
    );
  }
});

test('the reference of merge-props has mergeProps with a and b required, and c, d and e optional', () => {
  const mergeProps = read('merge-props').functions.find(({ name }) => name === 'mergeProps');
  assert.deepEqual(
    mergeProps?.parameters.map(({ name, optional }) => [name, optional]),
    [
      ['a', false],
      ['b', false],
      ['c', true],
      ['d', true],
      ['e', true],
    ],
  );
});

test('the reference of use-render has useRender.Parameters with defaultTagName and its default', () => {
  const parameters = read('use-render').types.find(({ name }) => name === 'useRender.Parameters');
  assert.equal(
    parameters?.properties.find(({ name }) => name === 'defaultTagName')?.default,
    "'div'",
  );
});

test('the reference of button has the prop disabled and the attribute data-disabled', () => {
  const [button] = read('button').parts;
  assert.equal(button.name, 'Button');
  assert.equal(button.props.find(({ name }) => name === 'disabled')?.default, 'false');
  assert.deepEqual(button.dataAttributes, [
    { name: 'data-disabled', type: null, description: 'Present when the button is disabled.' },
  ]);
});

test('the reference of progress has its parts in the sequence of the Base UI page', () => {
  assert.deepEqual(
    read('progress').parts.map(({ name }) => name),
    ['Progress.Root', 'Progress.Track', 'Progress.Indicator', 'Progress.Value', 'Progress.Label'],
  );
});

test('the reference of radio-group has the parts that its types.md repeats from radio, in the sequence of the Base UI page', () => {
  const { parts } = read('radio-group');
  assert.deepEqual(
    parts.map(({ name }) => name),
    ['RadioGroup', 'Radio.Root', 'Radio.Indicator'],
  );
  const [, root] = parts;
  assert.equal(root.props.find(({ name }) => name === 'value')?.required, true);
  assert.equal(
    root.dataAttributes.some(({ name }) => name === 'data-checked'),
    true,
  );
});

test('the reference of separator has data-orientation with its type', () => {
  const [separator] = read('separator').parts;
  assert.deepEqual(separator.dataAttributes, [
    {
      name: 'data-orientation',
      type: "'horizontal' | 'vertical'",
      description: 'Indicates the orientation of the separator.',
    },
  ]);
});

test('the reader throws and says what to do for a family with no family file', () => {
  assert.throws(
    () => read('no-such-family'),
    /^Error: There is no family file parity\/families\/no-such-family\.json, but the site has a page for no-such-family\. Add the family file\.$/,
  );
});

test('the reader throws and says what to do for a family whose extract has no types.md', () => {
  assert.throws(() => read('internals'), {
    message:
      'parity/families/internals.upstream.json has no types.md, so the API reference of internals has no source. Add the glob "docs/src/app/(docs)/react/components/internals/**" or "docs/src/app/(docs)/react/utils/internals/**" to "upstreamPaths" in parity/families/internals.json. Then run `pnpm parity:extract --upstream <path> internals`.',
  });
});
