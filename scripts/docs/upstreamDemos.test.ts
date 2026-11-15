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
const RERUN = 'Run `pnpm docs:demos --upstream <path> button`.';
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

function read(family: FamilyFile, paths: string[], tailwind = false) {
  return readUpstreamDemos('button', family, paths, (path) => `text of ${path}`, tailwind);
}

test('with no Tailwind demos, the record keeps the files of the demos and leaves out the Tailwind files and index.ts', () => {
  const { record, styles } = read(BUTTON, [
    'docs/src/app/(docs)/react/components/button/page.mdx',
    `${DEMOS}/_index.module.css`,
    `${DEMOS}/hero/index.ts`,
    `${DEMOS}/hero/css-modules/index.tsx`,
    `${DEMOS}/hero/css-modules/index.module.css`,
    `${DEMOS}/hero/tailwind/index.tsx`,
    `${DEMOS}/hero/tailwind/index.module.css`,
    `${DEMOS}/loading/css-modules/index.tsx`,
    `${DEMOS}/loading/css-modules/helper.ts`,
    `${DEMOS}-old/hero/css-modules/index.tsx`,
  ]);
  assert.deepEqual(Object.keys(record.files), [
    '_index.module.css',
    'hero/css-modules/index.tsx',
    'hero/css-modules/index.module.css',
    'loading/css-modules/index.tsx',
    'loading/css-modules/helper.ts',
  ]);
  assert.equal(record.files['_index.module.css'], sha256(`text of ${DEMOS}/_index.module.css`));
  assert.equal(record.commit, COMMIT);
  assert.equal(record.upstream, DEMOS);
  assert.deepEqual([...styles.keys()], ['_index.module.css', STYLE_PATH]);
  assert.equal(Object.hasOwn(record, 'classes'), false);
});

test('with Tailwind demos, the record also has the hashes of the Tailwind files and the class strings of each folder', () => {
  const texts = new Map([
    [`${DEMOS}/hero/index.ts`, "const noClass = 'index';"],
    [`${DEMOS}/hero/css-modules/index.tsx`, '<Button className={styles.Button} />'],
    [`${DEMOS}/hero/tailwind/index.tsx`, '<Button className="flex  h-8" />'],
    [`${DEMOS}/loading/tailwind/index.tsx`, '<Button className="b" />;\n<Button className="a" />'],
    [`${DEMOS}/loading/tailwind/helper.ts`, "const rowClass = 'b';"],
    [`${DEMOS}/_utils.ts`, "const x = { rootClass: 'no' }, itemClass = 'root';"],
  ]);
  const { record } = readUpstreamDemos(
    'button',
    BUTTON,
    [...texts.keys()],
    (path) => texts.get(path)!,
    true,
  );
  assert.deepEqual(Object.keys(record.files), [
    'hero/css-modules/index.tsx',
    'hero/tailwind/index.tsx',
    'loading/tailwind/index.tsx',
    'loading/tailwind/helper.ts',
    '_utils.ts',
  ]);
  assert.equal(record.files[TAILWIND_TSX_PATH], sha256('<Button className="flex  h-8" />'));
  assert.deepEqual(record.classes, {
    '.': ['root'],
    'hero/tailwind': ['flex h-8'],
    'loading/tailwind': ['a', 'b', 'b'],
  });
  assert.deepEqual(Object.keys(record), ['commit', 'upstream', 'files', 'classes']);
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
  const { record } = readUpstreamDemos(
    'button',
    BUTTON,
    [...texts.keys()],
    (path) => texts.get(path)!,
    false,
  );
  assert.deepEqual(record.entryPoints, { hero: ['checkbox', 'slider', 'toggle'] });
  const withTailwind = readUpstreamDemos(
    'button',
    BUTTON,
    [...texts.keys()],
    (path) => texts.get(path)!,
    true,
  );
  assert.deepEqual(withTailwind.record.entryPoints, {
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
    false,
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
    classes: { 'hero/tailwind': [classes], loading: ['a', 'b'] },
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
      '    "hero/tailwind": [',
      `      "${classes}"`,
      '    ],',
      '    "loading": ["a", "b"]',
      '  }',
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
    name: 'button',
    matchedCommit: COMMIT,
    record: makeRecord(),
    files: new Map([
      ['upstream.json', sha256('record')],
      [STYLE_PATH, sha256(STYLE)],
      [VUE_PATH, sha256('vue')],
    ]),
    vueClasses: new Map(),
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
  classes: { 'hero/tailwind': [CLASS_A, CLASS_B, CLASS_B] },
};

/** The state of the family before its Vue file of the Tailwind demo exists. */
const NO_TAILWIND_VUE: Partial<DemoFamily> = { files: CSS_MODULES_FILES, vueClasses: new Map() };

function makeTailwindFamily(overrides: Partial<DemoFamily> = {}): DemoFamily {
  return makeDemoFamily({
    record: TAILWIND_RECORD,
    files: new Map([...CSS_MODULES_FILES, [TAILWIND_VUE_PATH, sha256('tailwind vue')]]),
    vueClasses: new Map([['hero/tailwind', [CLASS_B, CLASS_A, CLASS_B]]]),
    ...overrides,
  });
}

test('a family with a record, the copies and the Vue file of each demo has no problem', () => {
  assert.deepEqual(checkDemos([makeDemoFamily()], ENTRY_POINTS), []);
});

test('a family whose Tailwind demos have the class strings of Base UI, in any sequence, has no problem', () => {
  assert.deepEqual(checkDemos([makeTailwindFamily()], ENTRY_POINTS), []);
});

const WAITING = makeDemoFamily({
  record: { ...makeRecord(), entryPoints: { hero: ['button', 'toggle'] } },
  files: new Map([[STYLE_PATH, sha256(STYLE)]]),
});

test('the check has no problem for a demo with no Vue file while an entry point that it imports is absent', () => {
  assert.deepEqual(checkDemos([WAITING], ENTRY_POINTS), []);
});

test('the check reports a demo with no Vue file when each entry point that it imports exists', () => {
  assert.deepEqual(checkDemos([WAITING], new Set([...ENTRY_POINTS, 'toggle'])), [
    'docs/demos/button/hero/css-modules/index.vue does not exist. Base UI has the demo hero. Port it.',
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
    'docs/demos/button/hero/tailwind/index.vue does not exist. Base UI has the Tailwind demo hero. Port it.',
  ]);
});

const FORMS_DEMOS = 'docs/src/app/(docs)/react/handbook/forms/demos';

/** A family whose Base UI demo `react-hook-form` is the Vue demo `vee-validate`. */
function makeFormsFamily(overrides: Partial<DemoFamily> = {}): DemoFamily {
  return {
    name: 'handbook-forms',
    matchedCommit: COMMIT,
    record: {
      commit: COMMIT,
      upstream: FORMS_DEMOS,
      files: { 'react-hook-form/tailwind/index.tsx': sha256('tailwind') },
      classes: { 'react-hook-form/tailwind': [CLASS_A] },
    },
    files: new Map([
      ['upstream.json', sha256('record')],
      ['vee-validate/tailwind/index.vue', sha256('vue')],
    ]),
    vueClasses: new Map([['react-hook-form/tailwind', [CLASS_A]]]),
    ...overrides,
  };
}

test('a demo with another name in Base UI has no problem when its Vue folder has the name that the map gives', () => {
  assert.deepEqual(checkDemos([makeFormsFamily()], ENTRY_POINTS), []);
});

test('the check names the Vue folder of a demo that has another name in Base UI', () => {
  const family = makeFormsFamily({
    files: new Map([['upstream.json', sha256('record')]]),
    vueClasses: new Map(),
  });
  assert.deepEqual(checkDemos([family], ENTRY_POINTS), [
    'docs/demos/handbook-forms/vee-validate/tailwind/index.vue does not exist. Base UI has the Tailwind demo react-hook-form. Port it.',
  ]);
  assert.deepEqual(
    checkDemos(
      [makeFormsFamily({ vueClasses: new Map([['react-hook-form/tailwind', []]]) })],
      ENTRY_POINTS,
    ),
    [
      `docs/demos/handbook-forms/vee-validate/tailwind has class strings that differ from Base UI. Absent: "${CLASS_A}". Copy each class string from the Base UI file. Do not change it.`,
    ],
  );
});

const NO_FAMILY_FILE =
  'parity/families/button.json does not exist, but button has a page or a demo folder. Add the family file. For a component that Base UI does not have, add parity/own/button.json.';

const failures: { name: string; family: DemoFamily; problem: string }[] = [
  {
    name: 'a family with no record',
    family: makeDemoFamily({ record: undefined }),
    problem: `docs/demos/button/upstream.json does not exist. ${RERUN}`,
  },
  {
    name: 'a record at another commit than matchedCommit',
    family: makeDemoFamily({ record: makeRecord(OTHER_COMMIT) }),
    problem: `docs/demos/button/upstream.json: the record was read at commit ${OTHER_COMMIT}, but matchedCommit of button is ${COMMIT}. ${RERUN}`,
  },
  {
    name: 'a copied style sheet that differs from the record',
    family: makeDemoFamily({
      files: new Map([
        [STYLE_PATH, sha256(`${STYLE}\n`)],
        [VUE_PATH, sha256('vue')],
      ]),
    }),
    problem: `docs/demos/button/${STYLE_PATH} differs from the style sheet of Base UI. Do not edit a copied style sheet. ${RERUN}`,
  },
  {
    name: 'a recorded style sheet that has no copy',
    family: makeDemoFamily({ files: new Map([[VUE_PATH, sha256('vue')]]) }),
    problem: `docs/demos/button/${STYLE_PATH} does not exist. ${RERUN}`,
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
      'docs/demos/button/hero/css-modules/own.module.css is not in docs/demos/button/upstream.json. Base UI has no such style sheet. Delete the file.',
  },
  {
    name: 'a demo of Base UI that has no Vue file',
    family: makeDemoFamily({ files: new Map([[STYLE_PATH, sha256(STYLE)]]) }),
    problem:
      'docs/demos/button/hero/css-modules/index.vue does not exist. Base UI has the demo hero. Port it.',
  },
  {
    name: 'a Tailwind demo of Base UI that has no Vue file',
    family: makeTailwindFamily(NO_TAILWIND_VUE),
    problem:
      'docs/demos/button/hero/tailwind/index.vue does not exist. Base UI has the Tailwind demo hero. Port it.',
  },
  {
    name: 'a class string that the demo lacks and a class string that Base UI lacks',
    family: makeTailwindFamily({
      vueClasses: new Map([['hero/tailwind', [CLASS_A, CLASS_B, 'flex h-9']]]),
    }),
    problem: `docs/demos/button/hero/tailwind has class strings that differ from Base UI. Absent: "${CLASS_B}". Extra: "flex h-9". Copy each class string from the Base UI file. Do not change it.`,
  },
  {
    name: 'a class string that Base UI repeats and the demo does not',
    family: makeTailwindFamily({
      vueClasses: new Map([['hero/tailwind', [CLASS_A, CLASS_B]]]),
    }),
    problem: `docs/demos/button/hero/tailwind has class strings that differ from Base UI. Absent: "${CLASS_B}". Copy each class string from the Base UI file. Do not change it.`,
  },
  {
    name: 'a Tailwind folder of a demo for which the record has no Tailwind file',
    family: makeDemoFamily({
      files: new Map([...CSS_MODULES_FILES, [TAILWIND_VUE_PATH, sha256('tailwind vue')]]),
    }),
    problem: `docs/demos/button/hero/tailwind is not in docs/demos/button/upstream.json. ${RERUN} When the record still lacks the folder, Base UI has no such Tailwind demo. Delete the folder.`,
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

test('an own component with a page and a demo folder is not a demo family, so the check has no problem', () => {
  const root = makeRoot({ 'parity/own/sample.json': OWN_RECORD });
  const families = loadDemoFamilies(root);
  assert.deepEqual(families, []);
  assert.deepEqual(checkDemos(families, ENTRY_POINTS), []);
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

test('the class strings of a Vue demo come with the family, by the folder of each row of the record', () => {
  const record = {
    commit: COMMIT,
    upstream: DEMOS,
    files: {},
    classes: { '.': ['d'], 'hero/tailwind': ['a b', 'c'], 'loading/tailwind': ['e'] },
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
      ['.', ['d']],
      ['hero/tailwind', ['a b', 'c']],
    ]),
  );
});

test('each demo and each copied style sheet of the repository match the record', () => {
  const families = loadDemoFamilies(REPOSITORY_ROOT);
  assert.notEqual(families.length, 0);
  assert.deepEqual(checkDemos(families, loadEntryPoints(REPOSITORY_ROOT)), []);
});
