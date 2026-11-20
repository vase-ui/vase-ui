import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import {
  checkDemos,
  demoFamilyNames,
  expectedFiles,
  loadDemoFamilies,
  loadEntryPoints,
  readUpstreamDemos,
} from './upstreamDemos.ts';
import type { DemoFamily, DemoRecord } from './upstreamDemos.ts';

const COMMIT = 'a'.repeat(40);
const OTHER_COMMIT = 'b'.repeat(40);
const DEMOS = 'docs/src/app/(docs)/react/components/button/demos';
const STYLE = '.Button {\n  margin: 0;\n}\n';
const STYLE_PATH = 'hero/css-modules/index.module.css';
const TSX_PATH = 'hero/css-modules/index.tsx';
const VUE_PATH = 'hero/css-modules/index.vue';
const TAILWIND_TSX_PATH = 'hero/tailwind/index.tsx';
const TAILWIND_VUE_PATH = 'hero/tailwind/index.vue';
const RERUN = 'Run `pnpm docs:demos --upstream <path> sample`.';
const ENTRY_POINTS = new Set(['button']);

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

function makeFamily(upstreamPaths: string[]): FamilyFile {
  return {
    upstreamPaths,
    matchedCommit: COMMIT,
    exceptions: [],
    surfaceAdditions: [],
    returnTypeDifferences: [],
    notApplicableCommits: [],
  };
}

const BUTTON = makeFamily([
  'packages/react/src/button/**',
  'docs/src/app/(docs)/react/components/button/**',
]);

function read(family: FamilyFile, paths: string[]) {
  return readUpstreamDemos('button', family, paths, (path) => `text of ${path}`);
}

function readTexts(texts: Map<string, string>) {
  return readUpstreamDemos('button', BUTTON, [...texts.keys()], (path) => texts.get(path)!);
}

test('the record has the files of each demo, the Tailwind files too, and leaves out index.ts', () => {
  const { record, styles } = read(BUTTON, [
    'docs/src/app/(docs)/react/components/button/page.mdx',
    `${DEMOS}/_index.module.css`,
    `${DEMOS}/hero/index.ts`,
    `${DEMOS}/hero/css-modules/index.tsx`,
    `${DEMOS}/hero/css-modules/index.module.css`,
    `${DEMOS}/hero/tailwind/index.tsx`,
    `${DEMOS}/loading/css-modules/index.tsx`,
    `${DEMOS}/loading/css-modules/helper.ts`,
    `${DEMOS}-old/hero/css-modules/index.tsx`,
  ]);
  assert.deepEqual(Object.keys(record.files), [
    '_index.module.css',
    'hero/css-modules/index.tsx',
    'hero/css-modules/index.module.css',
    'hero/tailwind/index.tsx',
    'loading/css-modules/index.tsx',
    'loading/css-modules/helper.ts',
  ]);
  assert.equal(record.files['_index.module.css'], sha256(`text of ${DEMOS}/_index.module.css`));
  assert.equal(record.files[TAILWIND_TSX_PATH], sha256(`text of ${DEMOS}/${TAILWIND_TSX_PATH}`));
  assert.equal(record.commit, COMMIT);
  assert.equal(record.upstream, DEMOS);
  assert.deepEqual([...styles.keys()], ['_index.module.css', STYLE_PATH]);
  assert.equal(Object.hasOwn(record, 'classes'), false);
});

test('the record has the class strings of each folder by element name', () => {
  const { record } = readTexts(
    new Map([
      [`${DEMOS}/hero/index.ts`, "const noClass = 'index';"],
      [`${DEMOS}/hero/css-modules/index.tsx`, '<Button className={styles.Button} />'],
      [`${DEMOS}/hero/tailwind/index.tsx`, '<Button className="flex  h-8" />'],
      [
        `${DEMOS}/loading/tailwind/index.tsx`,
        '<Button className={rowClass} />;\n<Button className="a" />;\n<span className="b" />',
      ],
      [`${DEMOS}/loading/tailwind/helper.ts`, "export const rowClass = 'b';"],
      [`${DEMOS}/_utils.ts`, "const x = { rootClass: 'no' }, itemClass = 'root';"],
    ]),
  );
  assert.deepEqual(record.classes, {
    '.': { itemClass: ['root'] },
    'hero/tailwind': { Button: ['flex h-8'] },
    'loading/tailwind': { Button: ['a', 'b'], span: ['b'] },
  });
  assert.deepEqual(Object.keys(record), ['commit', 'upstream', 'files', 'classes']);
});

const VARIANT_FILES = (demo: string, cssModules: string, tailwind: string): [string, string][] => [
  [`${DEMOS}/${demo}/css-modules/index.tsx`, cssModules],
  [`${DEMOS}/${demo}/tailwind/index.tsx`, tailwind],
];

test('the record lists, sorted, the demos whose two variants differ in more than their classes and their text', () => {
  const { record } = readTexts(
    new Map([
      ...VARIANT_FILES('equal', '<p className={styles.P}>Open</p>', '<p className="a">Close</p>'),
      ...VARIANT_FILES('other-element', '<div />', '<span />'),
      ...VARIANT_FILES('another-element', '<div />', '<section />'),
      [`${DEMOS}/other-file/css-modules/index.tsx`, '<div />'],
      [`${DEMOS}/other-file/tailwind/index.tsx`, '<div />'],
      [`${DEMOS}/other-file/tailwind/classes.ts`, "export const boxClass = 'a';"],
      [`${DEMOS}/tailwind-only/tailwind/index.tsx`, '<div />'],
      [`${DEMOS}/css-modules-only/css-modules/index.tsx`, '<div />'],
    ]),
  );
  assert.deepEqual(record.differentVariants, ['another-element', 'other-element', 'other-file']);
  assert.deepEqual(Object.keys(record), [
    'commit',
    'upstream',
    'files',
    'classes',
    'differentVariants',
  ]);
});

test('a record with no demo whose variants differ has no key for them', () => {
  const { record } = readTexts(
    new Map(
      VARIANT_FILES('hero', '<p className={styles.P}>Open</p>', '<p className="a">Close</p>'),
    ),
  );
  assert.equal(Object.hasOwn(record, 'differentVariants'), false);
});

test('an upstream folder with no demos gives a record with no files', () => {
  const { record, styles } = read(BUTTON, [
    'docs/src/app/(docs)/react/components/button/page.mdx',
    'docs/src/app/(docs)/react/components/button/types.md',
  ]);
  assert.deepEqual(record, { commit: COMMIT, upstream: DEMOS, files: {} });
  assert.equal(styles.size, 0);
});

test('a family with no docs folder in its upstream paths is an error that says what to add', () => {
  assert.throws(() => read(makeFamily(['packages/react/src/button/**']), []), {
    message:
      'parity/families/button.json: "upstreamPaths" has no docs folder. Add the glob "docs/src/app/(docs)/react/components/button/**" or "docs/src/app/(docs)/react/utils/button/**". Then run `pnpm parity:extract --upstream <path> button`.',
  });
});

test('the record names the other entry points that each demo imports, sorted and with no repeat', () => {
  const texts = new Map([
    [
      `${DEMOS}/hero/css-modules/index.tsx`,
      [
        "import * as React from 'react';",
        "import { Slider } from '@base-ui/react/slider';",
        "import { Button } from '@base-ui/react/button';",
        "import { Toggle } from '@base-ui/react/toggle';",
        "import styles from './index.module.css';",
      ].join('\n'),
    ],
    [
      `${DEMOS}/hero/css-modules/helper.ts`,
      "export { Checkbox } from '@base-ui/react/checkbox';\nexport { Toggle } from '@base-ui/react/toggle';\nimport type { Foo } from '@base-ui/react/button/foo';\n",
    ],
    [`${DEMOS}/hero/tailwind/index.tsx`, "import { Menu } from '@base-ui/react/menu';"],
    [`${DEMOS}/loading/css-modules/index.tsx`, "import { Button } from '@base-ui/react/button';"],
    [`${DEMOS}/loading/css-modules/index.module.css`, '.Button {}\n'],
  ]);
  assert.deepEqual(readTexts(texts).record.entryPoints, {
    hero: ['checkbox', 'menu', 'slider', 'toggle'],
  });
});

test('a record whose demos import only their own entry point has no key for entry points', () => {
  const path = `${DEMOS}/hero/css-modules/index.tsx`;
  const { record } = readUpstreamDemos(
    'button',
    BUTTON,
    [path],
    () => "import { Button } from '@base-ui/react/button';",
  );
  assert.equal(Object.hasOwn(record, 'entryPoints'), false);
});

test('the record file has a short array on one line, a long array on lines of its own and the files on lines of their own, as Prettier writes them', async () => {
  const classes =
    'flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950';
  const record: DemoRecord = {
    commit: COMMIT,
    upstream: DEMOS,
    files: { [TSX_PATH]: sha256('tsx') },
    entryPoints: { hero: ['slider', 'toggle'] },
    classes: {
      'hero/tailwind': { 'Switch.Root': [classes], div: ['a', 'b'] },
      loading: { p: ['c'] },
    },
    differentVariants: ['hero', 'loading'],
  };
  const files = await expectedFiles('button', { record, styles: new Map() });
  assert.equal(
    files.get('docs/demos/button/upstream.json'),
    [
      '{',
      `  "commit": "${COMMIT}",`,
      `  "upstream": "${DEMOS}",`,
      '  "files": {',
      `    "${TSX_PATH}": "${sha256('tsx')}"`,
      '  },',
      '  "entryPoints": {',
      '    "hero": ["slider", "toggle"]',
      '  },',
      '  "classes": {',
      '    "hero/tailwind": {',
      '      "Switch.Root": [',
      `        "${classes}"`,
      '      ],',
      '      "div": ["a", "b"]',
      '    },',
      '    "loading": {',
      '      "p": ["c"]',
      '    }',
      '  },',
      '  "differentVariants": ["hero", "loading"]',
      '}',
      '',
    ].join('\n'),
  );
});

function makeRecord(commit = COMMIT): DemoRecord {
  return {
    commit,
    upstream: DEMOS,
    files: { [TSX_PATH]: sha256('tsx'), [STYLE_PATH]: sha256(STYLE) },
  };
}

function makeDemoFamily(overrides: Partial<DemoFamily> = {}): DemoFamily {
  return {
    name: 'sample',
    own: false,
    matchedCommit: COMMIT,
    record: makeRecord(),
    files: new Map([
      ['upstream.json', sha256('record')],
      [STYLE_PATH, sha256(STYLE)],
      [VUE_PATH, sha256('vue')],
    ]),
    vueClasses: new Map(),
    vueVariants: new Map(),
    ...overrides,
  };
}

const CLASS_A = 'flex h-8 px-3';
const CLASS_B = 'data-disabled:border-neutral-500';
const CSS_MODULES_FILES = makeDemoFamily().files;

/** The record of a family that has the Tailwind demo of `hero`. Base UI repeats the class string B. */
const TAILWIND_RECORD: DemoRecord = {
  ...makeRecord(),
  files: { ...makeRecord().files, [TAILWIND_TSX_PATH]: sha256('tailwind') },
  classes: { 'hero/tailwind': { Button: [CLASS_A, CLASS_B, CLASS_B] } },
};

/** The state of the family before its Vue file of the Tailwind demo exists. */
const NO_TAILWIND_VUE: Partial<DemoFamily> = { files: CSS_MODULES_FILES, vueClasses: new Map() };

function makeTailwindFamily(overrides: Partial<DemoFamily> = {}): DemoFamily {
  return makeDemoFamily({
    record: TAILWIND_RECORD,
    files: new Map([...CSS_MODULES_FILES, [TAILWIND_VUE_PATH, sha256('tailwind vue')]]),
    vueClasses: new Map([['hero/tailwind', { Button: [CLASS_B, CLASS_A, CLASS_B] }]]),
    ...overrides,
  });
}

test('a demo of a family of native form parts can have a style sheet and classes of its own', () => {
  const family = makeTailwindFamily({
    name: 'checkbox',
    files: new Map([
      ...CSS_MODULES_FILES,
      [STYLE_PATH, sha256('.Checkbox:checked {}')],
      [TAILWIND_VUE_PATH, sha256('tailwind vue')],
    ]),
    vueClasses: new Map([['hero/tailwind', { input: ['appearance-none checked:bg-black'] }]]),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), []);
});

test('a demo that imports a family of native form parts can have a style sheet and classes of its own', () => {
  const family = makeTailwindFamily({
    record: { ...TAILWIND_RECORD, entryPoints: { hero: ['button'] } },
    files: new Map([
      ...CSS_MODULES_FILES,
      [STYLE_PATH, sha256('.Button:disabled {}')],
      [TAILWIND_VUE_PATH, sha256('tailwind vue')],
    ]),
    vueClasses: new Map([['hero/tailwind', { Button: ['flex disabled:text-neutral-500'] }]]),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), []);
});

test('a family with a record, the copies and the Vue file of each demo has no problem', () => {
  assert.deepEqual(checkDemos([makeDemoFamily()], ENTRY_POINTS), []);
});

test('a family whose Tailwind demos have the class strings of Base UI on the same elements, in any sequence, has no problem', () => {
  assert.deepEqual(checkDemos([makeTailwindFamily()], ENTRY_POINTS), []);
});

const WAITING = makeDemoFamily({
  record: { ...makeRecord(), entryPoints: { hero: ['button', 'menu'] } },
  files: new Map([[STYLE_PATH, sha256(STYLE)]]),
});

test('the check has no problem for a demo with no Vue file while an entry point that it imports is absent', () => {
  assert.deepEqual(checkDemos([WAITING], ENTRY_POINTS), []);
});

test('the check reports a demo with no Vue file when each entry point that it imports exists', () => {
  assert.deepEqual(checkDemos([WAITING], new Set([...ENTRY_POINTS, 'menu'])), [
    'docs/demos/sample/hero/css-modules/index.vue does not exist. Base UI has the demo hero. Port it.',
  ]);
});

const WAITING_TAILWIND = makeTailwindFamily({
  ...NO_TAILWIND_VUE,
  record: { ...TAILWIND_RECORD, entryPoints: { hero: ['menu'] } },
});

test('the check has no problem for a Tailwind demo with no Vue file while an entry point that it imports is absent', () => {
  assert.deepEqual(checkDemos([WAITING_TAILWIND], ENTRY_POINTS), []);
});

test('the check reports a Tailwind demo with no Vue file when each entry point that it imports exists', () => {
  assert.deepEqual(checkDemos([WAITING_TAILWIND], new Set([...ENTRY_POINTS, 'menu'])), [
    'docs/demos/sample/hero/tailwind/index.vue does not exist. Base UI has the Tailwind demo hero. Port it.',
  ]);
});

const FORMS_DEMOS = 'docs/src/app/(docs)/react/handbook/forms/demos';

/** A family whose Base UI demo `react-hook-form` is the Vue demo `vee-validate`. */
function makeFormsFamily(overrides: Partial<DemoFamily> = {}): DemoFamily {
  return {
    name: 'handbook-forms',
    own: false,
    matchedCommit: COMMIT,
    record: {
      commit: COMMIT,
      upstream: FORMS_DEMOS,
      files: { 'react-hook-form/tailwind/index.tsx': sha256('tailwind') },
      classes: { 'react-hook-form/tailwind': { Field: [CLASS_A] } },
    },
    files: new Map([
      ['upstream.json', sha256('record')],
      ['vee-validate/tailwind/index.vue', sha256('vue')],
    ]),
    vueClasses: new Map([['vee-validate/tailwind', { Field: [CLASS_A] }]]),
    vueVariants: new Map(),
    ...overrides,
  };
}

test('a demo with another name in Base UI has no problem when its Vue folder has the name that the map gives', () => {
  assert.deepEqual(checkDemos([makeFormsFamily()], ENTRY_POINTS), []);
});

test('a demo named constructor keeps its folder when another demo has an entry point', () => {
  const family = makeFormsFamily({
    record: {
      commit: COMMIT,
      upstream: FORMS_DEMOS,
      files: {
        'constructor/tailwind/index.tsx': sha256('tailwind'),
        'other/tailwind/index.tsx': sha256('other'),
      },
      entryPoints: { other: ['toggle'] },
    },
    files: new Map([['constructor/tailwind/index.vue', sha256('vue')]]),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), []);
});

test('the check names the Vue folder of a demo that has another name in Base UI', () => {
  const family = makeFormsFamily({
    files: new Map([['upstream.json', sha256('record')]]),
    vueClasses: new Map(),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), [
    'docs/demos/handbook-forms/vee-validate/tailwind/index.vue does not exist. Base UI has the Tailwind demo react-hook-form. Port it.',
  ]);
});

const FORM_DIFFERENCE =
  'css-modules/index.vue has "Font weight" where tailwind/index.vue has "Playback speed"';
const TEXT_DIFFERENCE =
  'css-modules/index.vue has aria-label="Trigger 1" where tailwind/index.vue has aria-label="Controlled tooltip"';

test('two Vue variants with no difference have no problem', () => {
  const family = makeTailwindFamily({
    vueVariants: new Map([['hero', { form: undefined, text: undefined }]]),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), []);
});

test('two Vue variants whose Base UI variants differ are compared by their texts only', () => {
  const family = makeTailwindFamily({
    record: { ...TAILWIND_RECORD, differentVariants: ['hero'] },
    vueVariants: new Map([['hero', { form: FORM_DIFFERENCE, text: undefined }]]),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), []);
});

test('the demo of the Vue variants is listed with its name in Base UI', () => {
  const variants = new Map([['vee-validate', { form: FORM_DIFFERENCE, text: undefined }]]);
  const listed = makeFormsFamily({
    record: { ...makeFormsFamily().record!, differentVariants: ['react-hook-form'] },
    vueVariants: variants,
  });
  assert.deepEqual(checkDemos([listed], ENTRY_POINTS), []);
  assert.deepEqual(checkDemos([makeFormsFamily({ vueVariants: variants })], ENTRY_POINTS), [
    `docs/demos/handbook-forms/vee-validate: the Tailwind demo differs from the CSS-module demo in more than its classes, and the two Base UI files do not. ${FORM_DIFFERENCE}. Make the two demos equal apart from the classes.`,
  ]);
});

const NO_FAMILY_FILE =
  'parity/families/sample.json does not exist, but sample has a page or a demo folder. Add the family file. For a component that Base UI does not have, add parity/own/sample.json.';

const failures: { name: string; family: DemoFamily; problem: string }[] = [
  {
    name: 'a family with no record',
    family: makeDemoFamily({ record: undefined }),
    problem: `docs/demos/sample/upstream.json does not exist. ${RERUN}`,
  },
  {
    name: 'a record at another commit than matchedCommit',
    family: makeDemoFamily({ record: makeRecord(OTHER_COMMIT) }),
    problem: `docs/demos/sample/upstream.json: the record was read at commit ${OTHER_COMMIT}, but matchedCommit of sample is ${COMMIT}. ${RERUN}`,
  },
  {
    name: 'a copied style sheet that differs from the record',
    family: makeDemoFamily({
      files: new Map([
        [STYLE_PATH, sha256(`${STYLE}\n`)],
        [VUE_PATH, sha256('vue')],
      ]),
    }),
    problem: `docs/demos/sample/${STYLE_PATH} differs from the style sheet of Base UI. Do not edit a copied style sheet. ${RERUN}`,
  },
  {
    name: 'a recorded style sheet that has no copy',
    family: makeDemoFamily({ files: new Map([[VUE_PATH, sha256('vue')]]) }),
    problem: `docs/demos/sample/${STYLE_PATH} does not exist. ${RERUN}`,
  },
  {
    name: 'a style sheet that the record does not have',
    family: makeDemoFamily({
      files: new Map([
        [STYLE_PATH, sha256(STYLE)],
        [VUE_PATH, sha256('vue')],
        ['hero/css-modules/own.module.css', sha256('own')],
      ]),
    }),
    problem:
      'docs/demos/sample/hero/css-modules/own.module.css is not in docs/demos/sample/upstream.json. Base UI has no such style sheet. Delete the file.',
  },
  {
    name: 'a demo of Base UI that has no Vue file',
    family: makeDemoFamily({ files: new Map([[STYLE_PATH, sha256(STYLE)]]) }),
    problem:
      'docs/demos/sample/hero/css-modules/index.vue does not exist. Base UI has the demo hero. Port it.',
  },
  {
    name: 'a Tailwind demo of Base UI that has no Vue file',
    family: makeTailwindFamily(NO_TAILWIND_VUE),
    problem:
      'docs/demos/sample/hero/tailwind/index.vue does not exist. Base UI has the Tailwind demo hero. Port it.',
  },
  {
    name: 'a class string that the demo lacks and a class string that Base UI lacks',
    family: makeTailwindFamily({
      vueClasses: new Map([['hero/tailwind', { Button: [CLASS_A, CLASS_B, 'flex h-9'] }]]),
    }),
    problem: `docs/demos/sample/hero/tailwind has classes that differ from Base UI. Button: absent "${CLASS_B}", extra "flex h-9". Copy each class string from the Base UI file to the same element. Do not change it.`,
  },
  {
    name: 'a class string that Base UI repeats and the demo does not',
    family: makeTailwindFamily({
      vueClasses: new Map([['hero/tailwind', { Button: [CLASS_A, CLASS_B] }]]),
    }),
    problem: `docs/demos/sample/hero/tailwind has classes that differ from Base UI. Button: absent "${CLASS_B}". Copy each class string from the Base UI file to the same element. Do not change it.`,
  },
  {
    name: 'a class string on an element that Base UI gives no class',
    family: makeTailwindFamily({
      vueClasses: new Map([
        ['hero/tailwind', { Button: [CLASS_A, CLASS_B, CLASS_B], div: [CLASS_A] }],
      ]),
    }),
    problem: `docs/demos/sample/hero/tailwind has classes that differ from Base UI. div: extra "${CLASS_A}". Copy each class string from the Base UI file to the same element. Do not change it.`,
  },
  {
    name: 'the class strings of two elements that change places',
    family: makeTailwindFamily({
      record: {
        ...TAILWIND_RECORD,
        classes: { 'hero/tailwind': { 'Switch.Root': [CLASS_A], 'Switch.Thumb': [CLASS_B] } },
      },
      vueClasses: new Map([
        ['hero/tailwind', { 'Switch.Root': [CLASS_B], 'Switch.Thumb': [CLASS_A] }],
      ]),
    }),
    problem: `docs/demos/sample/hero/tailwind has classes that differ from Base UI. Switch.Root: absent "${CLASS_A}", extra "${CLASS_B}". Switch.Thumb: absent "${CLASS_B}", extra "${CLASS_A}". Copy each class string from the Base UI file to the same element. Do not change it.`,
  },
  {
    name: 'two Vue variants that differ in more than their classes while the two Base UI variants do not',
    family: makeTailwindFamily({
      vueVariants: new Map([['hero', { form: FORM_DIFFERENCE, text: undefined }]]),
    }),
    problem: `docs/demos/sample/hero: the Tailwind demo differs from the CSS-module demo in more than its classes, and the two Base UI files do not. ${FORM_DIFFERENCE}. Make the two demos equal apart from the classes.`,
  },
  {
    name: 'two Vue variants with other texts while the two Base UI variants differ',
    family: makeTailwindFamily({
      record: { ...TAILWIND_RECORD, differentVariants: ['hero'] },
      vueVariants: new Map([['hero', { form: FORM_DIFFERENCE, text: TEXT_DIFFERENCE }]]),
    }),
    problem: `docs/demos/sample/hero: the Tailwind demo has other texts than the CSS-module demo. ${TEXT_DIFFERENCE}. Give the Tailwind demo the texts of the CSS-module demo.`,
  },
  {
    name: 'a Tailwind folder of a demo for which the record has no Tailwind file',
    family: makeDemoFamily({
      files: new Map([...CSS_MODULES_FILES, [TAILWIND_VUE_PATH, sha256('tailwind vue')]]),
    }),
    problem: `docs/demos/sample/hero/tailwind is not in docs/demos/sample/upstream.json. ${RERUN} When the record still lacks the folder, Base UI has no such Tailwind demo. Delete the folder.`,
  },
  {
    name: 'a family with no family file',
    family: makeDemoFamily({ matchedCommit: undefined }),
    problem: NO_FAMILY_FILE,
  },
  {
    name: 'a family with no family file and no record',
    family: makeDemoFamily({ matchedCommit: undefined, record: undefined }),
    problem: NO_FAMILY_FILE,
  },
];

for (const { name, family, problem } of failures) {
  test(`the check reports ${name} and nothing else`, () => {
    assert.deepEqual(checkDemos([family], ENTRY_POINTS), [problem]);
  });
}

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the entry points are the folders of the source that have an index.ts', () => {
  const root = mkdtempSync(join(tmpdir(), 'entry-points-'));
  roots.push(root);
  for (const path of [
    'packages/vue/src/button/index.ts',
    'packages/vue/src/unstable-use-media-query/index.ts',
    'packages/vue/src/common/owner.ts',
    'packages/vue/src/index.ts',
  ]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), '');
  }
  assert.deepEqual(loadEntryPoints(root), new Set(['button', 'unstable-use-media-query']));
});

function makeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'demo-families-'));
  roots.push(root);
  const upstream = {
    commit: COMMIT,
    describe: 'v1.0.0',
    release: '1.0.0',
    components: ['button'],
    commits: [{ sha: COMMIT, date: '2026-01-01T00:00:00+00:00', subject: 'First', paths: [] }],
  };
  for (const [path, text] of Object.entries({
    'parity/upstream.json': JSON.stringify(upstream),
    'docs/components/sample.md': '# Sample\n',
    'docs/demos/sample/hero/css-modules/index.vue': '<template></template>\n',
    ...files,
  })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const OWN_RECORD = JSON.stringify({
  standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'],
  reason: 'Base UI has no such component.',
  parts: ['Root'],
});

const OWN_CSS_MODULES = 'docs/demos/sample/hero/css-modules/index.vue';
const OWN_TAILWIND = 'docs/demos/sample/hero/tailwind/index.vue';

function makeOwnRoot(files: Record<string, string>): string {
  return makeRoot({ 'parity/own/sample.json': OWN_RECORD, ...files });
}

test('the demo record keeps upstream paths and both Vue variants use the Vase UI folder', async () => {
  const demo = 'prevent-base-ui-handler';
  const folder = 'docs/demos/sample/prevent-vase-ui-handler';
  const style = `${demo}/css-modules/index.module.css`;
  const demos = readTexts(
    new Map([
      ...VARIANT_FILES(demo, '<div>Save</div>', '<span className="px-2">Save</span>'),
      [`${DEMOS}/${style}`, STYLE],
    ]),
  );
  const copies = await expectedFiles('sample', demos);
  assert.equal(demos.record.files[style], sha256(STYLE));
  assert.equal(copies.get(`${folder}/css-modules/index.module.css`), STYLE);

  const root = makeRoot({
    ...Object.fromEntries(copies),
    'parity/families/sample.json': JSON.stringify(BUTTON),
    [`${folder}/css-modules/index.vue`]: '<template><div>Save</div></template>',
    [`${folder}/tailwind/index.vue`]: '<template><span class="px-2">Save</span></template>',
  });
  const families = loadDemoFamilies(root);
  assert.deepEqual(families[0].vueClasses.get('prevent-vase-ui-handler/tailwind'), {
    span: ['px-2'],
  });
  assert.deepEqual(checkDemos(families, ENTRY_POINTS), []);
});

test('an own component with a page and a demo folder is a demo family with no record, and the command leaves it out', () => {
  const root = makeOwnRoot({ 'docs/demos/sample/upstream.json': 'not a record' });
  assert.deepEqual(
    loadDemoFamilies(root).map(({ name, own, matchedCommit, record }) => ({
      name,
      own,
      matchedCommit,
      record,
    })),
    [{ name: 'sample', own: true, matchedCommit: undefined, record: undefined }],
  );
  assert.deepEqual(demoFamilyNames(root, new Set(['sample'])), []);
});

test('an own demo whose two variants differ only in their classes has no problem', () => {
  const root = makeOwnRoot({
    [OWN_CSS_MODULES]: '<template><p :class="styles.Text">Open</p></template>\n',
    [OWN_TAILWIND]: '<template><p class="text-sm">Open</p></template>\n',
  });
  const families = loadDemoFamilies(root);
  assert.deepEqual(
    families.map(({ name }) => name),
    ['sample'],
  );
  assert.deepEqual(checkDemos(families, ENTRY_POINTS), []);
});

test('the class strings of an own demo come with the family, by its Tailwind folders', () => {
  const root = makeOwnRoot({
    [OWN_CSS_MODULES]: '<template><p class="plain">Open</p></template>\n',
    [OWN_TAILWIND]: '<template><p :class="textClass">Open</p></template>\n',
    'docs/demos/sample/hero/tailwind/classes.ts': "export const textClass = 'text-sm';\n",
    'docs/demos/sample/loading/tailwind/index.vue': '<template><p class="a  b" /></template>\n',
  });
  const [family] = loadDemoFamilies(root);
  assert.deepEqual(
    family?.vueClasses,
    new Map([
      ['hero/tailwind', { p: ['text-sm'] }],
      ['loading/tailwind', { p: ['a b'] }],
    ]),
  );
});

test('an own demo with one variant is a problem that names the absent file', () => {
  const root = makeOwnRoot({
    'docs/demos/sample/loading/tailwind/index.vue': '<template></template>\n',
  });
  assert.deepEqual(checkDemos(loadDemoFamilies(root), ENTRY_POINTS), [
    "docs/demos/sample/hero/tailwind/index.vue does not exist. A demo of a component of Vase UI's own has the two variants. Add the Tailwind demo.",
    "docs/demos/sample/loading/css-modules/index.vue does not exist. A demo of a component of Vase UI's own has the two variants. Add the CSS-module demo.",
  ]);
});

test('an own demo whose Tailwind variant has another text is a problem that names the difference', () => {
  const root = makeOwnRoot({
    [OWN_CSS_MODULES]: '<template><p>Open</p></template>\n',
    [OWN_TAILWIND]: '<template><p class="text-sm">Close</p></template>\n',
  });
  assert.deepEqual(checkDemos(loadDemoFamilies(root), ENTRY_POINTS), [
    'docs/demos/sample/hero: the Tailwind demo differs from the CSS-module demo in more than its classes. css-modules/index.vue has "Open" where tailwind/index.vue has "Close". Make the two demos equal apart from the classes.',
  ]);
});

test('a page with neither a family file nor an own record is a demo family, so the check reports it', () => {
  const root = makeRoot({});
  const families = loadDemoFamilies(root);
  assert.deepEqual(
    families.map(({ name }) => name),
    ['sample'],
  );
  assert.deepEqual(checkDemos(families, ENTRY_POINTS), [
    'parity/families/sample.json does not exist, but sample has a page or a demo folder. Add the family file. For a component that Base UI does not have, add parity/own/sample.json.',
  ]);
});

test('the class strings of a Vue demo come with the family, by the folder of each row of the record and by element name', () => {
  const record = {
    commit: COMMIT,
    upstream: DEMOS,
    files: {},
    classes: {
      '.': { li: ['d'] },
      'hero/tailwind': { div: ['a b'], rowClass: ['c'] },
      'loading/tailwind': { p: ['e'] },
    },
  };
  const root = makeRoot({
    'docs/demos/sample/upstream.json': JSON.stringify(record),
    'docs/demos/sample/hero/tailwind/index.vue': '<template><div class="a  b" /></template>\n',
    'docs/demos/sample/hero/tailwind/utils.ts': "export const rowClass = 'c';\n",
    'docs/demos/sample/hero/tailwind/index.module.css': '.a {}\n',
    'docs/demos/sample/utils.ts': "export const itemClass = 'd';\n",
  });
  const [family] = loadDemoFamilies(root);
  assert.deepEqual(
    family?.vueClasses,
    new Map([
      ['.', { itemClass: ['d'] }],
      ['hero/tailwind', { div: ['a b'], rowClass: ['c'] }],
    ]),
  );
});

test('the class strings of a demo with another name in Base UI come from the Vue folder that the map gives', () => {
  const record = {
    commit: COMMIT,
    upstream: FORMS_DEMOS,
    files: {},
    classes: { 'react-hook-form/tailwind': { div: ['a b'] } },
  };
  const root = makeRoot({
    'docs/demos/handbook-forms/upstream.json': JSON.stringify(record),
    'docs/demos/handbook-forms/vee-validate/tailwind/index.vue':
      '<template><div class="a b" /></template>\n',
  });
  const family = loadDemoFamilies(root).find(({ name }) => name === 'handbook-forms');
  assert.deepEqual(family?.vueClasses, new Map([['vee-validate/tailwind', { div: ['a b'] }]]));
});

test('the first difference between the Vue variants of a demo comes with the family, for each demo that has both', () => {
  const root = makeRoot({
    'docs/demos/sample/loading/css-modules/index.vue': '<template><p>Open</p></template>\n',
    'docs/demos/sample/same/css-modules/index.vue': '<template><p>Open</p></template>\n',
    'docs/demos/sample/same/tailwind/index.vue': '<template><p class="a">Open</p></template>\n',
    'docs/demos/sample/other/css-modules/index.vue': '<template><p>Open</p></template>\n',
    'docs/demos/sample/other/tailwind/index.vue': '<template><p>Close</p></template>\n',
    'docs/demos/sample/tailwind-only/tailwind/index.vue': '<template><p>Open</p></template>\n',
  });
  const [family] = loadDemoFamilies(root);
  assert.deepEqual(
    family?.vueVariants,
    new Map([
      [
        'other',
        {
          form: 'css-modules/index.vue has "Open" where tailwind/index.vue has "Close"',
          text: 'css-modules/index.vue has "Open" where tailwind/index.vue has "Close"',
        },
      ],
      ['same', { form: undefined, text: undefined }],
    ]),
  );
});

test('each demo and each copied style sheet of the repository match the record', () => {
  const families = loadDemoFamilies(REPOSITORY_ROOT);
  assert.notEqual(families.length, 0);
  assert.deepEqual(checkDemos(families, loadEntryPoints(REPOSITORY_ROOT)), []);
});
