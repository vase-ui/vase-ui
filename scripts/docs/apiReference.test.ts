import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { readTypesMd } from '../parity/typesMd.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { createVaseProject } from '../parity/vaseSurface.ts';
import type { HeadingBadge } from '../parity/headingBadge.ts';
import type { OwnComponent } from '../parity/parityFiles.ts';
import {
  buildApiClasses,
  buildApiFunctions,
  buildApiParts,
  buildApiTypes,
  buildOwnApiReference,
  createApiReferenceReader,
  readPartBadges,
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

// The copy is in `node_modules` of the repository. The fixtures thus find `vue` as the fixture
// folder does, and no tool reads the copy.
function copyFixtures(context: TestContext): string {
  const root = mkdtempSync(join(REPOSITORY_ROOT, 'node_modules', '.api-reference-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(FIXTURES, root, { recursive: true });
  return root;
}

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

test('a prop has its type, documented default, required mark and description, and as comes last', () => {
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
    ['disabled', 'keepMounted', 'name', 'side', 'as'],
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
      type: '"top" | "bottom" | undefined',
      default: "'bottom'",
      required: false,
      description: 'Which side of the trigger the popup uses.',
    },
  );
  // The default of Vue is `false`, but the JSDoc has no `@default` tag.
  assert.equal(props.find(({ name }) => name === 'keepMounted')?.default, null);
});

test('a prop with the tag @ignore is not in the reference', () => {
  const { props } = withTexts(
    [
      [
        POPUP,
        '/** Whether the popup is disabled. */',
        '/**\n   * Whether the popup is disabled.\n   * @ignore\n   */',
      ],
    ],
    () => part('Sample.Popup'),
  );
  assert.equal(
    props.some(({ name }) => name === 'disabled'),
    false,
  );
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

test('the classes are the functions of the types.md that are a class export, with the path of the export as name', () => {
  const [createHandle] = types.functions;
  const file = { ...types, functions: [createHandle, { ...createHandle, name: 'Handle' }] };
  const classes = withTexts(
    [
      [
        PARTS,
        'export interface Handle {\n  open: () => void;\n  close: () => void;\n}',
        'export class Handle {\n  open(): void {}\n  close(): void {}\n}',
      ],
    ],
    () => buildApiClasses(project, ENTRY, file),
  );
  assert.deepEqual(
    classes.map(({ name, methods }) => [name, methods.map((method) => method.name)]),
    [['Sample.Handle', ['open', 'close']]],
  );
  assert.deepEqual(buildApiClasses(project, ENTRY, file), []);
});

test('the types are the types and then the additional types of the types.md that have one property or more or are a union of strings, with the path of the export as name, the properties in the sequence of their names and the values in the sequence of the declaration', () => {
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
      ['SampleRootChangeEventReason', [], ['trigger-press', 'escape-key', 'none']],
      ['SampleRootChangeEventDetails', ['cancel', 'event', 'isCanceled', 'reason'], []],
    ],
  );
});

test('a type can be in a namespace of a namespace, and a union of strings in a namespace has its values', () => {
  const reference = withTexts(
    [[PARTS, CREATE_HANDLE, `export type Reason = 'open' | 'close';\n\n${CREATE_HANDLE}`]],
    () =>
      buildApiTypes(project, ENTRY, {
        types: [{ name: 'Sample.Root.Props' }, { name: 'Sample.Reason' }],
        additionalTypes: [],
      }),
  );
  assert.deepEqual(
    reference.map(({ name, properties, values }) => [name, properties.length > 0, values]),
    [
      ['Sample.Root.Props', true, []],
      ['Sample.Reason', false, ['open', 'close']],
    ],
  );
});

function makeOwnComponent(changes: Partial<OwnComponent> = {}): OwnComponent {
  return {
    standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'],
    reason: 'Base UI has no sample component.',
    parts: ['Popup', 'Ghost', 'Root'],
    functions: ['createHandle', 'ghost'],
    types: ['SampleRootChangeEventReason', 'Ghost', 'Sample.Handle'],
    ...changes,
  };
}

test('the reference of an own component has the parts, functions and types of its record in their sequence, and leaves out a name with no export', () => {
  const reference = buildOwnApiReference(project, ENTRY, makeOwnComponent());
  assert.deepEqual(
    reference.parts.map(({ name }) => name),
    ['Sample.Popup', 'Sample.Root'],
  );
  assert.deepEqual(
    reference.functions.map(({ name }) => name),
    ['Sample.createHandle'],
  );
  assert.deepEqual(reference.classes, []);
  assert.deepEqual(
    reference.types.map(({ name }) => name),
    ['SampleRootChangeEventReason', 'Sample.Handle'],
  );
});

test('the reference of an own component has the classes of its functions', () => {
  const { classes, functions } = withTexts(
    [
      [
        PARTS,
        'export interface Handle {\n  open: () => void;\n  close: () => void;\n}',
        'export class Handle {\n  open(): void {}\n  close(): void {}\n}',
      ],
    ],
    () => buildOwnApiReference(project, ENTRY, makeOwnComponent({ functions: ['Handle'] })),
  );
  assert.deepEqual(
    classes.map(({ name }) => name),
    ['Sample.Handle'],
  );
  assert.deepEqual(functions, []);
});

test('the reference of an own component takes a name of its parts for a component only, and a name of its functions for a function only', () => {
  const reference = buildOwnApiReference(
    project,
    ENTRY,
    makeOwnComponent({ parts: ['createHandle'], functions: ['Root'], types: undefined }),
  );
  assert.deepEqual(reference.parts, []);
  assert.deepEqual(reference.functions, []);
  assert.deepEqual(reference.types, []);
});

const PAGE = 'docs/src/app/(docs)/react/components/sample/page.mdx';

function makePage(referenceBadges: Record<string, HeadingBadge>) {
  return { file: PAGE, referenceTags: Object.keys(referenceBadges), referenceBadges };
}

test('a part has the badge that the Base UI page shows on the heading above its tag, and each other part has none', () => {
  const badges = readPartBadges(types, [makePage({ 'TypesSample.Popup': 'Preview' })]);
  assert.deepEqual(
    buildApiParts(project, ENTRY, types, badges).map(({ name, badge }) => [name, badge]),
    [
      ['Sample.Root', null],
      ['Sample.Popup', 'Preview'],
    ],
  );
});

test('a types.md has no badge from a page with no badge, or from the page of another folder', () => {
  assert.deepEqual(
    readPartBadges(types, [{ file: PAGE, referenceTags: ['TypesSample.Popup'] }]),
    new Map(),
  );
  const otherPage = {
    ...makePage({ 'TypesSample.Popup': 'New' }),
    file: 'docs/src/app/(docs)/react/components/other/page.mdx',
  };
  assert.deepEqual(readPartBadges(types, [otherPage]), new Map());
});

for (const tag of ['TypesSample.createHandle', 'TypesSample']) {
  test(`the reference refuses a badge on the heading of <${tag}>, which is not the heading of a part`, () => {
    assert.throws(() => readPartBadges(types, [makePage({ [tag]: 'New' })]), {
      message: new RegExp(
        `^The Base UI page docs/src/app/\\(docs\\)/react/components/sample/page\\.mdx has the badge New on the heading above <${tag}>, but docs/src/app/\\(docs\\)/react/components/sample/types\\.md has no part for that tag\\. `,
      ),
    });
  });
}

const read = createApiReferenceReader(REPOSITORY_ROOT);

const ROOT_MEMBERS = ['unmount', 'close', 'inputElement'];

for (const { family, part, members } of [
  { family: 'select', part: 'Select.Root', members: ROOT_MEMBERS },
  { family: 'combobox', part: 'Combobox.Root', members: ROOT_MEMBERS },
  { family: 'autocomplete', part: 'Autocomplete.Root', members: ROOT_MEMBERS },
  {
    family: 'resizable',
    part: 'Resizable.Panel',
    members: ['element', 'collapse', 'expand', 'resize', 'isCollapsed', 'getSize'],
  },
]) {
  test(`the exposed members of ${part} keep the sequence of defineExpose`, () => {
    assert.deepEqual(
      read(family)
        .parts.find(({ name }) => name === part)
        ?.exposed.map(({ name }) => name),
      members,
    );
  });
}

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

test('each prop and each event of each family page has a type, and each event has a description', () => {
  const missing = listFamilyPages(join(REPOSITORY_ROOT, 'docs')).flatMap(({ family }) =>
    read(family).parts.flatMap((apiPart) => [
      ...apiPart.props.flatMap(({ name, type }) =>
        type ? [] : [`${apiPart.name} prop ${name}: type`],
      ),
      ...apiPart.events.flatMap(({ name, type, description }) => [
        ...(type ? [] : [`${apiPart.name} event ${name}: type`]),
        ...(description ? [] : [`${apiPart.name} event ${name}: description`]),
      ]),
    ]),
  );
  assert.deepEqual(missing, []);
});

test('the reference of a family page does not change with the families that the reader read before', () => {
  const families = listFamilyPages(join(REPOSITORY_ROOT, 'docs')).map(({ family }) => family);
  const readBackward = createApiReferenceReader(REPOSITORY_ROOT);
  const backward = new Map(families.toReversed().map((family) => [family, readBackward(family)]));
  for (const family of families) {
    assert.deepEqual(
      backward.get(family),
      read(family),
      `The reference of ${family} changes with the sequence of the reads.`,
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

test('the reference lists the default model, the named models and the item value', () => {
  const [toggle] = read('toggle').parts;
  const [select] = read('select').parts;
  const [checkbox] = read('checkbox').parts;

  for (const [part, formerModel] of [
    [toggle, 'pressed'],
    [select, 'value'],
    [checkbox, 'checked'],
  ] as const) {
    const props = part.props.map(({ name }) => name);
    const events = part.events.map(({ name }) => name);
    assert.ok(props.includes('modelValue'));
    assert.ok(!props.includes(formerModel));
    assert.ok(events.includes('update:modelValue'));
    assert.ok(!events.includes('update:' + formerModel));
  }

  assert.ok(toggle.props.some(({ name }) => name === 'value'));
  assert.ok(toggle.events.some(({ name }) => name === 'pressedChange'));
  assert.ok(select.events.some(({ name }) => name === 'update:open'));
});

test('the reference of progress has its parts in the sequence of the Base UI page', () => {
  assert.deepEqual(
    read('progress').parts.map(({ name }) => name),
    ['Progress.Root', 'Progress.Track', 'Progress.Indicator', 'Progress.Value', 'Progress.Label'],
  );
});

test('the reference of radio-group has the part that its types.md repeats from radio, in the sequence of the Base UI page', () => {
  const { parts } = read('radio-group');
  assert.deepEqual(
    parts.map(({ name }) => name),
    ['RadioGroup', 'Radio'],
  );
  const [, radio] = parts;
  assert.equal(radio.props.find(({ name }) => name === 'value')?.required, true);
});

test('the reference of a family with one part has the part under the name of the family', () => {
  assert.deepEqual(
    read('switch').parts.map(({ name }) => name),
    ['Switch'],
  );
});

test('the reference of a part that other families export again has the description of its JSDoc', () => {
  const parts = ['separator', 'menu', 'context-menu', 'otp-field'].map((family) =>
    read(family).parts.find(({ name }) => name.endsWith('Separator')),
  );
  assert.deepEqual(
    parts.map((part) => [part?.name, part?.description]),
    ['Separator', 'Menu.Separator', 'ContextMenu.Separator', 'OTPField.Separator'].map((name) => [
      name,
      'A separator element accessible to screen readers.\nRenders a `<div>` element.',
    ]),
  );
});

test('the reference of Select.Separator has data-orientation with its type', () => {
  const separator = read('select').parts.find(({ name }) => name === 'Select.Separator');
  assert.deepEqual(separator?.dataAttributes, [
    {
      name: 'data-orientation',
      type: "'horizontal' | 'vertical'",
      description: 'Indicates the orientation of the separator.',
    },
  ]);
});

test('the reader throws and says what to do for a family with no family file and no record', () => {
  assert.throws(
    () => read('no-such-family'),
    /^Error: There is no family file parity\/families\/no-such-family\.json and no record parity\/own\/no-such-family\.json, but the site has a page for no-such-family\. Add the family file\. For a component that Base UI does not have, add the record\.$/,
  );
});

test('the reader gives the reference of an own component from its record, with no family file', () => {
  const reference = createApiReferenceReader(FIXTURES)('sample');
  assert.deepEqual(
    reference.parts.map(({ name }) => name),
    ['Sample.Root', 'Sample.Popup'],
  );
  assert.deepEqual(
    reference.functions.map(({ name }) => name),
    ['Sample.createHandle'],
  );
  assert.deepEqual(
    reference.types.map(({ name }) => name),
    ['Sample.Handle', 'SampleRootChangeEventReason'],
  );
});

test('the reader with `cache` gives the reference of the first read for each later read of a family', () => {
  const readOnce = createApiReferenceReader(FIXTURES, { cache: true });
  assert.equal(readOnce('sample'), readOnce('sample'));
});

test('the reader without `cache` makes the reference of a family again for each read', () => {
  const readAgain = createApiReferenceReader(FIXTURES);
  const first = readAgain('sample');
  const second = readAgain('sample');
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});

test('the reader without `cache` reads edited JSDoc and defaults from disk', (context) => {
  const root = copyFixtures(context);
  const popup = join(root, 'packages/vue/src/sample/popup/SamplePopup.vue');
  const source = readFileSync(popup, 'utf8');
  const readAgain = createApiReferenceReader(root);
  const readSide = () =>
    readAgain('sample')
      .parts.find(({ name }) => name === 'Sample.Popup')
      ?.props.find(({ name }) => name === 'side');
  const before = readSide();
  assert.equal(before?.description, 'Which side of the trigger the popup uses.');
  assert.equal(before.default, null);
  writeFileSync(
    popup,
    source.replace(
      '/** Which side of the trigger the popup uses. */',
      "/**\n   * The preferred side of the trigger.\n   * @default 'top'\n   */",
    ),
  );
  assert.deepEqual(readSide(), {
    ...before,
    description: 'The preferred side of the trigger.',
    default: "'top'",
  });
  writeFileSync(popup, source);
  assert.deepEqual(readSide(), before);
});

test('the reader without `cache` reads added and removed props from disk', (context) => {
  const root = copyFixtures(context);
  const popup = join(root, 'packages/vue/src/sample/popup/SamplePopup.vue');
  const source = readFileSync(popup, 'utf8');
  const readAgain = createApiReferenceReader(root);
  const readProps = () =>
    readAgain('sample').parts.find(({ name }) => name === 'Sample.Popup')?.props;
  const before = readProps();
  assert.equal(
    before?.some(({ name }) => name === 'label'),
    false,
  );
  writeFileSync(
    popup,
    source.replace(
      '  name: string;',
      '  name: string;\n  /** The popup label. */\n  label?: string | undefined;',
    ),
  );
  assert.deepEqual(
    readProps()?.find(({ name }) => name === 'label'),
    {
      name: 'label',
      type: 'string | undefined',
      default: null,
      required: false,
      description: 'The popup label.',
    },
  );
  writeFileSync(popup, source);
  assert.deepEqual(readProps(), before);
});

test('the reader without `cache` reads edited imported TypeScript files from disk', (context) => {
  const root = copyFixtures(context);
  const parts = join(root, 'packages/vue/src/sample/index.parts.ts');
  const source = readFileSync(parts, 'utf8');
  const readAgain = createApiReferenceReader(root);
  const readHandle = () => readAgain('sample').types.find(({ name }) => name === 'Sample.Handle');
  const before = readHandle();
  assert.equal(before?.properties.find(({ name }) => name === 'close')?.type, '() => void');
  writeFileSync(
    parts,
    source
      .replace('  close: () => void;', '  /** Closes the popup. */\n  close: () => boolean;')
      .replace('close() {}', 'close() { return true; }'),
  );
  assert.deepEqual(
    readHandle()?.properties.find(({ name }) => name === 'close'),
    {
      name: 'close',
      type: '() => boolean',
      optional: false,
      default: null,
      description: 'Closes the popup.',
    },
  );
  writeFileSync(parts, source);
  assert.deepEqual(readHandle(), before);
});

test('the reader without `cache` reads a new file that an earlier edit imports', (context) => {
  const root = copyFixtures(context);
  const parts = join(root, 'packages/vue/src/sample/index.parts.ts');
  const readAgain = createApiReferenceReader(root);
  const readHandleProperties = () =>
    readAgain('sample')
      .types.find(({ name }) => name === 'Sample.Handle')
      ?.properties.map(({ name }) => name);
  writeFileSync(
    parts,
    `import type { Toggle } from './toggle';\n${readFileSync(parts, 'utf8').replace(
      'export interface Handle {',
      'export interface Handle extends Toggle {',
    )}`,
  );
  assert.deepEqual(readHandleProperties(), ['close', 'open']);
  writeFileSync(
    join(root, 'packages/vue/src/sample/toggle.ts'),
    'export interface Toggle {\n  toggle: () => void;\n}\n',
  );
  assert.deepEqual(readHandleProperties(), ['close', 'open', 'toggle']);
});

test('the reader without `cache` keeps its project while each file keeps its modification time and its size', (context) => {
  const root = copyFixtures(context);
  const popup = join(root, 'packages/vue/src/sample/popup/SamplePopup.vue');
  const source = readFileSync(popup, 'utf8');
  const time = new Date(0);
  utimesSync(popup, time, time);
  const readAgain = createApiReferenceReader(root);
  const readName = () =>
    readAgain('sample')
      .parts.find(({ name }) => name === 'Sample.Popup')
      ?.props.find(({ name }) => name === 'name')?.description;
  assert.equal(readName(), 'The name of the popup.');
  writeFileSync(popup, source.replace('The name of the popup.', 'The text of the popup.'));
  utimesSync(popup, time, time);
  assert.equal(readName(), 'The name of the popup.');
});

test('the reader throws and says what to do for a family whose extract has no types.md', () => {
  assert.throws(() => read('internals'), {
    message:
      'parity/families/internals.upstream.json has no types.md, so the API reference of internals has no source. Add the glob "docs/src/app/(docs)/react/components/internals/**" or "docs/src/app/(docs)/react/utils/internals/**" to "upstreamPaths" in parity/families/internals.json. Then run `pnpm parity:extract --upstream <path> internals`.',
  });
});

test('the reference of menu has the badge Preview on Menu.FilterProvider, as the Base UI page has, and on no other part', () => {
  assert.deepEqual(
    read('menu').parts.flatMap(({ name, badge }) => (badge === null ? [] : [[name, badge]])),
    [['Menu.FilterProvider', 'Preview']],
  );
});
