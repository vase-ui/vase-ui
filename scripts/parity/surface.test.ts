import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSurface } from './checkSurface.ts';
import type { ExceptionRow, FamilyExtract, FamilyFile } from './parityFiles.ts';
import { vaseFiles } from './paths.ts';
import { listVaseFiles } from './repository.ts';
import { readTypesMd } from './typesMd.ts';
import { createVaseProject, readEmitDescriptions } from './vaseSurface.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SAMPLE = join(FIXTURES, 'packages/vue/src/sample');
const TYPES_MD = 'docs/src/app/(docs)/react/components/sample/types.md';
const COMMIT = 'a'.repeat(40);

const ROOT = join(SAMPLE, 'root/SampleRoot.vue');
const POPUP = join(SAMPLE, 'popup/SamplePopup.vue');
const PARTS = join(SAMPLE, 'index.parts.ts');
const DATA_ATTRIBUTES = join(SAMPLE, 'popup/SamplePopupDataAttributes.ts');

const project = createVaseProject(join(FIXTURES, 'tsconfig.json'));
const files = vaseFiles(listVaseFiles(FIXTURES));
const surface = readTypesMd(TYPES_MD, readFileSync(join(FIXTURES, 'sample.types.md'), 'utf8'));
const extract: FamilyExtract = {
  commit: COMMIT,
  upstreamPaths: ['docs/**'],
  sources: [],
  typeTests: [],
  cases: [],
  surface: [surface],
};

function makeFamily(
  exceptions: ExceptionRow[] = [],
  surfaceAdditions: FamilyFile['surfaceAdditions'] = [
    { entry: 'Popup', prop: 'disabled', reason: 'The part reads it from the native attributes.' },
  ],
): FamilyFile {
  return {
    upstreamPaths: ['docs/**'],
    matchedCommit: COMMIT,
    exceptions,
    surfaceAdditions,
    notApplicableCommits: [],
  };
}

function check(family: FamilyFile = makeFamily()) {
  return checkSurface({
    name: 'sample',
    family,
    extract,
    files,
    root: FIXTURES,
    project: () => project,
  });
}

function entryRow(entry: string, overrides: Partial<ExceptionRow> = {}): ExceptionRow {
  return { upstream: TYPES_MD, entry, kind: 'not-applicable', reason: 'A reason.', ...overrides };
}

/** Changes the text of one fixture file in memory for the time of `run`. The file text is put back after it. */
function withEdits<T>(path: string, edits: [string, string][], run: () => T): T {
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
  assert.notEqual(edited, original);
  project.updateFile(path, edited);
  try {
    return run();
  } finally {
    project.updateFile(path, original);
  }
}

test('the fixture family matches its types.md, with the exposed members of a generic SFC', () => {
  const [root] = project.findExports(join(SAMPLE, 'index.ts'), 'Root');
  assert.deepEqual([...(project.readComponent(root)?.exposed ?? [])].sort(), ['close', 'unmount']);
  assert.deepEqual(check().problems, []);
  assert.deepEqual(check().summary, {
    entries: { total: 5, matched: 5, excepted: 0 },
    propRows: { total: 13, matched: 13, excepted: 0 },
  });
});

const seeds: { name: string; file: string; edits: [string, string][]; message: string }[] = [
  {
    name: 'an exposed member that the part lacks',
    file: ROOT,
    edits: [['defineExpose({ close, unmount });', 'defineExpose({ unmount });']],
    message: 'missing exposed member `close` (Base UI row `actionsRef`)',
  },
  {
    name: 'a missing prop',
    file: POPUP,
    edits: [
      [
        '  /** Whether to keep the popup in the DOM while the sample is closed. */\n  keepMounted?: boolean | undefined;\n',
        '',
      ],
      ['  keepMounted: false,\n', ''],
    ],
    message: 'missing prop `keepMounted` (Base UI row `keepMounted`)',
  },
  {
    name: 'a prop with no upstream row',
    file: POPUP,
    edits: [
      [
        '  disabled?: boolean | undefined;\n',
        '  disabled?: boolean | undefined;\n  extra?: string | undefined;\n',
      ],
      ['  disabled: false,\n', '  disabled: false,\n  extra: undefined,\n'],
    ],
    message: 'prop `extra` has no Base UI row',
  },
  {
    name: 'a required difference',
    file: POPUP,
    edits: [['  name: string;\n', '  name?: string | undefined;\n']],
    message: 'prop `name` is required in Base UI and optional here',
  },
  {
    name: 'a default difference',
    file: POPUP,
    edits: [["  side: 'bottom',", "  side: 'top',"]],
    message: "prop `side` has the default `'top'`. Base UI has the default `'bottom'`",
  },
  {
    name: 'a controlled prop with a default that is not undefined',
    file: ROOT,
    edits: [['  open: undefined,\n', '  open: false,\n']],
    message: 'controlled prop `open` has the default `false`',
  },
  {
    name: 'a missing change emit',
    file: ROOT,
    edits: [
      [
        '  /** Fires first, with the details. A listener can cancel the change. */\n  openChange: [open: boolean, details: SampleRootChangeEventDetails];\n',
        '',
      ],
      ["  emit('openChange', false, details);\n", ''],
    ],
    message: 'missing emit `openChange` (Base UI row `onOpenChange`)',
  },
  {
    name: 'a missing update emit',
    file: ROOT,
    edits: [
      [
        "  /** Fires second, unless the details cancel the change. */\n  'update:open': [open: boolean];\n",
        '',
      ],
      ["  emit('update:open', false);\n", ''],
    ],
    message: 'missing emit `update:open` (Base UI row `onOpenChange`)',
  },
  {
    name: 'a missing slot',
    file: ROOT,
    edits: [
      [
        'defineSlots<{\n  default(props: { payload: Payload | undefined }): unknown;\n}>();',
        'defineSlots<{}>();',
      ],
      ['  <slot :payload="payload" />', '  <div />'],
    ],
    message: 'missing slot `default` (Base UI row `children`)',
  },
  {
    name: 'a missing state field',
    file: POPUP,
    edits: [
      ["  side: 'top' | 'bottom';\n  disabled: boolean;\n}", "  side: 'top' | 'bottom';\n}"],
      ['  disabled: props.disabled,\n', ''],
    ],
    message: 'missing state field `disabled` in `SamplePopupState`',
  },
  {
    name: 'a state field that Base UI does not have',
    file: POPUP,
    edits: [
      ['  disabled: boolean;\n}', '  disabled: boolean;\n  extra: boolean;\n}'],
      ['  disabled: props.disabled,\n', '  disabled: props.disabled,\n  extra: true,\n'],
    ],
    message: 'state field `extra` of `SamplePopupState` is not in Base UI',
  },
  {
    name: 'a missing reason',
    file: ROOT,
    edits: [["'trigger-press' | 'escape-key' | 'none'", "'trigger-press' | 'none'"]],
    message: 'missing reason `escape-key` in `SampleRootChangeEventReason`',
  },
  {
    name: 'a reason that Base UI does not have',
    file: ROOT,
    edits: [
      [
        "'trigger-press' | 'escape-key' | 'none'",
        "'trigger-press' | 'escape-key' | 'none' | 'extra'",
      ],
    ],
    message: 'reason `extra` of `SampleRootChangeEventReason` is not in Base UI',
  },
  {
    name: 'a constant with another value',
    file: DATA_ATTRIBUTES,
    edits: [["export const open = 'data-open';", "export const open = 'data-opened';"]],
    message:
      'constant `open` of `SamplePopupDataAttributes` has the value `data-opened`. Base UI has `data-open`',
  },
  {
    name: 'a missing constant',
    file: DATA_ATTRIBUTES,
    edits: [["export const closed = 'data-closed';\n", '']],
    message: 'missing constant `closed` in `SamplePopupDataAttributes`',
  },
  {
    name: 'a constant that Base UI does not have',
    file: DATA_ATTRIBUTES,
    edits: [
      [
        "export const closed = 'data-closed';",
        "export const closed = 'data-closed';\nexport const extra = 'data-extra';",
      ],
    ],
    message: 'constant `extra` of `SamplePopupDataAttributes` is not in Base UI',
  },
  {
    name: 'a missing export of a function entry',
    file: PARTS,
    edits: [
      ['export function createHandle(): Handle {\n  return { open() {}, close() {} };\n}\n', ''],
    ],
    message: 'missing export `createHandle`',
  },
  {
    name: 'an exposed member with no upstream row',
    file: POPUP,
    edits: [
      ['defineExpose({ element });', 'const extra = ref(0);\ndefineExpose({ element, extra });'],
    ],
    message: 'exposed member `extra` has no Base UI row',
  },
  {
    name: 'a prop for a native listener',
    file: POPUP,
    edits: [
      [
        '  disabled?: boolean | undefined;\n',
        '  disabled?: boolean | undefined;\n  onClick?: ((event: MouseEvent) => void) | undefined;\n',
      ],
      ['  disabled: false,\n', '  disabled: false,\n  onClick: undefined,\n'],
    ],
    message: '`onClick` is a native listener, so the part must not have the prop `onClick`',
  },
];

for (const { name, file, edits, message } of seeds) {
  test(`the check reports ${name} and nothing else`, () => {
    const { problems } = withEdits(file, edits, () => check());
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.equal(problems[0].includes(message), true, problems[0]);
  });
}

test('only a value export from an SFC is a component', () => {
  const entry = join(SAMPLE, 'index.ts');
  const [state] = project.findExports(entry, 'SamplePopupState');
  assert.equal(project.readComponent(state), undefined);
  const [namespace] = project.findExports(entry, 'Sample');
  assert.equal(project.readComponent(namespace), undefined);
  assert.deepEqual(
    project.findExports(entry, 'Popup').map(({ path }) => path),
    ['Sample.Popup'],
  );
});

test('the native attributes of a part are not props', () => {
  const [popup] = project.findExports(join(SAMPLE, 'index.ts'), 'Popup');
  const component = project.readComponent(popup);
  assert.deepEqual([...(component?.props.keys() ?? [])].sort(), [
    'as',
    'disabled',
    'keepMounted',
    'name',
    'side',
    'stateClass',
    'stateStyle',
  ]);
  assert.equal(
    check().problems.some((problem) => /onClick|`type`/.test(problem)),
    false,
  );
});

test('a surfaceAdditions row accepts a prop with no upstream row, and the check needs it', () => {
  assert.deepEqual(check(makeFamily([], [])).problems, [
    'sample: surface difference sample/Popup: prop `disabled` has no Base UI row. Add a "surfaceAdditions" row, or remove it.',
  ]);
  assert.deepEqual(check().problems, []);
});

const staleAdditions: {
  name: string;
  row: FamilyFile['surfaceAdditions'][number];
  place: string;
  message: string;
}[] = [
  {
    name: 'a member that the part does not have',
    row: { entry: 'Popup', prop: 'ghost', reason: 'A reason.' },
    place: 'Popup, prop ghost',
    message: 'the part does not have the prop `ghost`',
  },
  {
    name: 'a member that a Base UI row maps to',
    row: { entry: 'Popup', prop: 'side', reason: 'A reason.' },
    place: 'Popup, prop side',
    message: 'a Base UI row maps to the prop `side`',
  },
  {
    name: 'a part that the extract does not have',
    row: { entry: 'Ghost', emit: 'x', reason: 'A reason.' },
    place: 'Ghost, emit x',
    message: 'the extract has no part `Ghost`',
  },
];

for (const { name, row, place, message } of staleAdditions) {
  test(`a surfaceAdditions row for ${name} is stale`, () => {
    const family = makeFamily();
    family.surfaceAdditions.push(row);
    assert.deepEqual(check(family).problems, [
      `sample: stale row surfaceAdditions[1] (${place}): ${message}. Remove the row.`,
    ]);
  });
}

test('the description of an event is the text of its JSDoc', () => {
  const [root] = project.findExports(join(SAMPLE, 'index.ts'), 'Root');
  const emits = project.readComponent(root)?.emits;
  assert.equal(
    emits?.get('openChange')?.description,
    'Fires first, with the details. A listener can cancel the change.',
  );
  assert.equal(
    emits?.get('openChangeComplete')?.description,
    'Fires after the animations of the change end.',
  );
});

test('readEmitDescriptions reads the property form and the call signature form', () => {
  const source = [
    '<script setup lang="ts">',
    'defineEmits<{',
    '  /** From a property. */',
    '  change: [value: string];',
    '  /** From a call signature. */',
    "  (event: 'update', value: string): void;",
    '  noDocs: [];',
    '}>();',
    '</script>',
  ].join('\n');
  assert.deepEqual(
    [...readEmitDescriptions(source, 'x.vue')],
    [
      ['change', 'From a property.'],
      ['update', 'From a call signature.'],
      ['noDocs', ''],
    ],
  );
});

const missingKeepMounted: [string, string][] = [
  [
    '  /** Whether to keep the popup in the DOM while the sample is closed. */\n  keepMounted?: boolean | undefined;\n',
    '',
  ],
  ['  keepMounted: false,\n', ''],
];

test('an entry row covers each difference of its entry and is counted as excepted', () => {
  const result = withEdits(POPUP, missingKeepMounted, () => check(makeFamily([entryRow('Popup')])));
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.summary.entries, { total: 5, matched: 4, excepted: 1 });
  assert.equal(result.summary.propRows.excepted, 7);
});

test('a prop row covers only the differences of its Base UI row', () => {
  const row = entryRow('Popup', { prop: 'keepMounted' });
  assert.deepEqual(
    withEdits(POPUP, missingKeepMounted, () => check(makeFamily([row]))).problems,
    [],
  );
  const other = entryRow('Popup', { prop: 'side' });
  const problems = withEdits(POPUP, missingKeepMounted, () => check(makeFamily([other]))).problems;
  assert.equal(problems.length, 2);
  assert.match(problems[0], /missing prop `keepMounted`/);
  assert.match(problems[1], /stale row exceptions\[0\] .*prop "side"\): it covers no difference/);
});

test('an entry row that covers no difference is stale', () => {
  assert.deepEqual(check(makeFamily([entryRow('Popup')])).problems, [
    `sample: stale row exceptions[0] (${TYPES_MD}, entry "Popup"): it covers no difference. Remove the row.`,
  ]);
});

test('an entry row for an entry that the extract does not have is stale', () => {
  const problems = check(
    makeFamily([entryRow('Ghost'), entryRow('Popup', { prop: 'ghost' })]),
  ).problems;
  assert.equal(problems.length, 2);
  assert.match(
    problems[0],
    /stale row exceptions\[0\] .*entry "Ghost"\): the extract has nothing that the row names\. Remove the row, or run `pnpm parity:extract --upstream <path> sample` if the family paths changed\./,
  );
  assert.match(
    problems[1],
    /stale row exceptions\[1\] .*prop "ghost"\): the extract has nothing that the row names/,
  );
});

test('a waits-on entry row is stale when its target has a counterpart', () => {
  const row = entryRow('Popup', { kind: 'waits-on', waitsOn: 'packages/react/src/sample' });
  const result = withEdits(POPUP, missingKeepMounted, () => check(makeFamily([row])));
  assert.deepEqual(result.problems, [
    `sample: stale row exceptions[0] (${TYPES_MD}, entry "Popup"): Vase UI has the counterpart of packages/react/src/sample. Port the entry, then remove the row.`,
  ]);
});

test('a family with no part in the Vase UI source has a missing export for each entry', () => {
  const result = checkSurface({
    name: 'sample',
    family: makeFamily([], []),
    extract,
    files: vaseFiles([]),
    root: FIXTURES,
    project: () => project,
  });
  assert.deepEqual(
    result.problems.map((problem) => problem.replace(/ in .*$/, '')),
    [
      'sample: surface difference sample/Root: missing export `Root`',
      'sample: surface difference sample/Popup: missing export `Popup`',
      'sample: surface difference sample/createHandle: missing export `createHandle`',
      'sample: surface difference sample/SamplePopupCssVariables: missing export `SamplePopupCssVariables`',
      'sample: surface difference sample/SamplePopupDataAttributes: missing export `SamplePopupDataAttributes`',
    ],
  );
  assert.deepEqual(result.summary.entries, { total: 5, matched: 0, excepted: 0 });
});
