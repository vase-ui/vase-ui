import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { FamilyFile } from '../parity/parityFiles.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { checkDemos, loadDemoFamilies, readUpstreamDemos } from './upstreamDemos.ts';
import type { DemoFamily, DemoRecord } from './upstreamDemos.ts';

const COMMIT = 'a'.repeat(40);
const OTHER_COMMIT = 'b'.repeat(40);
const DEMOS = 'docs/src/app/(docs)/react/components/button/demos';
const STYLE = '.Button {\n  margin: 0;\n}\n';
const STYLE_PATH = 'hero/css-modules/index.module.css';
const TSX_PATH = 'hero/css-modules/index.tsx';
const VUE_PATH = 'hero/css-modules/index.vue';
const RERUN = 'Run `node scripts/docs/upstreamDemos.ts --upstream <path> button`.';

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

test('the record keeps the files of the demos and leaves out the Tailwind files and index.ts', () => {
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
    ...overrides,
  };
}

test('a family with a record, the copies and the Vue file of each demo has no problem', () => {
  assert.deepEqual(checkDemos([makeDemoFamily()]), []);
});

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
    name: 'a family with no family file',
    family: makeDemoFamily({ matchedCommit: undefined }),
    problem:
      'parity/families/button.json does not exist, but button has a page or a demo folder. Add the family file.',
  },
];

for (const { name, family, problem } of failures) {
  test(`the check reports ${name} and nothing else`, () => {
    assert.deepEqual(checkDemos([family]), [problem]);
  });
}

test('each copied style sheet of the repository matches its record', () => {
  const families = loadDemoFamilies(REPOSITORY_ROOT);
  assert.notEqual(families.length, 0);
  assert.deepEqual(checkDemos(families), []);
});
