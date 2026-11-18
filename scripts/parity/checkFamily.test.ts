import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestRow } from './cases.ts';
import { checkFamily } from './checkFamily.ts';
import type { ExceptionRow, FamilyExtract, FamilyFile } from './parityFiles.ts';
import { vaseFiles } from './paths.ts';

const COMMIT = 'a'.repeat(40);
const UPSTREAM_FILE = 'packages/utils/src/a.test.ts';
const VASE_FILE = 'packages/vue/src/common/a.test.ts';
const OTHER_TEST = 'packages/vue/src/common/other.test.ts';
const LATER = 'packages/utils/src/later.ts';

const first: TestRow = { describe: ['a'], title: 'first' };
const second: TestRow = { describe: ['a', 'inner'], title: 'second' };
const suite: TestRow = { describe: ['a'], suite: 'describeConformance' };

function makeExtract(overrides: Partial<FamilyExtract> = {}): FamilyExtract {
  return {
    commit: COMMIT,
    upstreamPaths: ['packages/utils/src/**'],
    sources: [],
    typeTests: [],
    cases: [{ file: UPSTREAM_FILE, rows: [first, second, suite] }],
    surface: [],
    pages: [],
    ...overrides,
  };
}

function makeFamily(exceptions: ExceptionRow[] = []): FamilyFile {
  return {
    upstreamPaths: ['packages/utils/src/**'],
    matchedCommit: COMMIT,
    exceptions,
    surfaceAdditions: [],
    returnTypeDifferences: [],
    notApplicableCommits: [],
  };
}

function row(overrides: Partial<ExceptionRow> & Pick<ExceptionRow, 'kind'>): ExceptionRow {
  return { upstream: UPSTREAM_FILE, reason: 'A reason.', ...overrides };
}

function run(
  exceptions: ExceptionRow[],
  options: {
    extract?: FamilyExtract;
    paths?: string[];
    rows?: Record<string, TestRow[]>;
    relocations?: Map<string, string[]>;
  } = {},
) {
  const rows = options.rows ?? {};
  return checkFamily('sample', makeFamily(exceptions), options.extract ?? makeExtract(), {
    files: { ...vaseFiles(options.paths ?? []), relocations: options.relocations },
    rowsOf: (path) => rows[path] ?? [],
  });
}

const coveringRows: ExceptionRow[] = [
  row({
    describe: ['a'],
    title: 'first',
    kind: 'replaced',
    test: OTHER_TEST,
  }),
  row({ describe: ['a', 'inner'], kind: 'waits-on', waitsOn: LATER }),
  row({ describe: ['a'], suite: 'describeConformance', kind: 'not-applicable' }),
];

test('ported titles take the Vase UI name and an engine row takes the upstream title', () => {
  const describe = ['BaseUIChangeEventDetails', 'Base UI handler'];
  const title = 'calls preventBaseUIHandler';
  const upstream = [
    { describe, title },
    { describe, suite: 'describeConformance' },
  ];
  const vase = ['VaseUIChangeEventDetails', 'Vase UI handler'];
  const result = run([row({ describe, title, kind: 'engine', engine: 'webkit' })], {
    extract: makeExtract({ cases: [{ file: UPSTREAM_FILE, rows: upstream }] }),
    paths: [VASE_FILE],
    rows: {
      [VASE_FILE]: [
        { describe: vase, title: 'calls preventVaseUIHandler', conditions: ['skipIf(isWebKit)'] },
        { describe: vase, suite: 'describeConformance' },
        { describe: [], title: 'as Base UI does' },
      ],
    },
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases.engine.webkit, 1);
  assert.equal(result.summary.suiteCalls.matched, 1);
  assert.equal(result.summary.rowsWithoutUpstream, 1);
});

test('a second copy of a ported block with the upstream name gives the Vase UI title', () => {
  const describe = ['Base UI handler'];
  const result = run([], {
    extract: makeExtract({
      cases: [{ file: UPSTREAM_FILE, rows: [{ describe, title: 'opens' }] }],
    }),
    paths: [VASE_FILE],
    rows: {
      [VASE_FILE]: [
        { describe: ['Vase UI handler'], title: 'opens' },
        { describe, title: 'opens' },
      ],
    },
  });
  assert.deepEqual(result.problems, [
    `${VASE_FILE}: use "Vase UI handler" for the test title "Base UI handler".`,
  ]);
});

test('a Vue-only title can cite Base UI when a ported case or block uses the same words', () => {
  const title = 'calls the Base UI handler';
  const describe = ['Base UI form'];
  const result = run([], {
    extract: makeExtract({ cases: [{ file: UPSTREAM_FILE, rows: [{ describe, title }] }] }),
    paths: [VASE_FILE],
    rows: {
      [VASE_FILE]: [
        { describe: ['Vase UI form'], title: 'calls the Vase UI handler' },
        { describe: ['upstream example', ...describe], title },
        { describe: [], title: 'Base UI form' },
        { describe: ['Vase UI form', title], title: 'uses the upstream example' },
      ],
    },
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases.matched, 1);
  assert.equal(result.summary.rowsWithoutUpstream, 3);
});

test('a row with no match and no exception is a problem for each kind of row', () => {
  const result = run([], { paths: [VASE_FILE], rows: { [VASE_FILE]: [first] } });
  assert.deepEqual(result.problems, [
    `sample: uncovered case "a > inner > second" in ${UPSTREAM_FILE}: Vase UI has no row for it. Port it, or add an exception row.`,
    `sample: uncovered suite call "a > describeConformance" in ${UPSTREAM_FILE}: Vase UI has no row for it. Port it, or add an exception row.`,
  ]);
  assert.equal(result.summary.cases.matched, 1);
});

test('a case row, a block row and a suite row each cover the rows that they name', () => {
  const result = run(coveringRows, { paths: [OTHER_TEST] });
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases.replaced, 1);
  assert.equal(result.summary.cases['waits-on'], 1);
  assert.equal(result.summary.suiteCalls['not-applicable'], 1);
});

test('a block row covers each row whose describe starts with its titles', () => {
  const result = run([row({ describe: ['a'], kind: 'not-applicable' })]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases['not-applicable'], 2);
  assert.equal(result.summary.suiteCalls['not-applicable'], 1);
});

test('a file row covers each row of the file', () => {
  const result = run([row({ kind: 'not-applicable' })]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases['not-applicable'], 2);
});

test('the most specific row covers a row, and a row that covers nothing else is stale', () => {
  const specific: ExceptionRow[] = [
    row({ describe: ['a'], title: 'first', kind: 'not-applicable' }),
    row({ describe: ['a', 'inner'], title: 'second', kind: 'not-applicable' }),
    row({ describe: ['a'], suite: 'describeConformance', kind: 'not-applicable' }),
  ];
  assert.deepEqual(run(specific).problems, []);
  const result = run([...specific, row({ kind: 'not-applicable' })]);
  assert.deepEqual(result.problems, [
    `sample: stale row exceptions[3] (${UPSTREAM_FILE}): it covers no row without a match. Remove the row.`,
  ]);
});

test('a waits-on row is a problem when its target has a counterpart', () => {
  const result = run([row({ kind: 'waits-on', waitsOn: LATER })], {
    paths: ['packages/vue/src/common/later.ts'],
  });
  assert.deepEqual(result.problems, [
    `sample: stale row exceptions[0] (${UPSTREAM_FILE}): Vase UI has the counterpart of ${LATER}. Port the tests, then remove the row.`,
  ]);
});

test('a waits-on row accepts a folder as its target', () => {
  const stale = run([row({ kind: 'waits-on', waitsOn: 'packages/utils/src/later' })], {
    paths: ['packages/vue/src/common/later/index.ts'],
  });
  assert.equal(stale.problems.length, 1);
  assert.equal(
    run([row({ kind: 'waits-on', waitsOn: 'packages/utils/src/later' })]).problems.length,
    0,
  );
});

const engineRow = row({
  describe: ['a'],
  title: 'first',
  kind: 'engine',
  engine: 'webkit',
  link: 'https://example.com/bug',
});

test('a condition that Base UI does not have needs an engine row', () => {
  const rows = { [VASE_FILE]: [{ ...first, conditions: ['skipIf(isWebKit)'] }, second, suite] };
  const without = run([], { paths: [VASE_FILE], rows });
  assert.deepEqual(without.problems, [
    `sample: added condition on case "a > first" in ${VASE_FILE}: Base UI does not have skipIf(isWebKit). Remove each added condition, or add an "engine" row.`,
  ]);
  const covered = run([engineRow], { paths: [VASE_FILE], rows });
  assert.deepEqual(covered.problems, []);
  assert.equal(covered.summary.cases.engine.webkit, 1);
});

test('the problem names each condition that Base UI does not have', () => {
  const conditions = ['skipIf(isWebKit)', 'runIf(hasTouch)'];
  const rows = { [VASE_FILE]: [{ ...first, conditions }, second, suite] };
  assert.deepEqual(run([], { paths: [VASE_FILE], rows }).problems, [
    `sample: added condition on case "a > first" in ${VASE_FILE}: Base UI does not have skipIf(isWebKit), runIf(hasTouch). Remove each added condition, or add an "engine" row.`,
  ]);
});

test('a condition that Base UI also has needs no engine row', () => {
  const extract = makeExtract({
    cases: [{ file: UPSTREAM_FILE, rows: [{ ...first, conditions: ['skipIf(isJSDOM)'] }] }],
  });
  const rows = { [VASE_FILE]: [{ ...first, conditions: ['skipIf(isJSDOM)'] }] };
  assert.deepEqual(run([], { extract, paths: [VASE_FILE], rows }).problems, []);
});

const addedConditionForms: { name: string; conditions: string[] }[] = [
  { name: 'a condition of its own', conditions: ['skipIf(isJSDOM)', 'skipIf(isWebKit)'] },
  { name: 'a term of a condition that Base UI has', conditions: ['skipIf(isJSDOM || isWebKit)'] },
  { name: 'a condition in place of the condition of Base UI', conditions: ['skipIf(isWebKit)'] },
];

for (const { name, conditions } of addedConditionForms) {
  test(`a case that Base UI also skips needs an engine row for ${name}`, () => {
    const extract = makeExtract({
      cases: [{ file: UPSTREAM_FILE, rows: [{ ...first, conditions: ['skipIf(isJSDOM)'] }] }],
    });
    const rows = { [VASE_FILE]: [{ ...first, conditions }] };
    assert.deepEqual(run([], { extract, paths: [VASE_FILE], rows }).problems, [
      `sample: added condition on case "a > first" in ${VASE_FILE}: Base UI does not have skipIf(isWebKit). Remove each added condition, or add an "engine" row.`,
    ]);
    const covered = run([engineRow], { extract, paths: [VASE_FILE], rows });
    assert.deepEqual(covered.problems, []);
    assert.equal(covered.summary.cases.engine.webkit, 1);
  });
}

test('a ported case can omit a term of a condition of Base UI', () => {
  const extract = makeExtract({
    cases: [
      {
        file: UPSTREAM_FILE,
        rows: [
          { ...first, conditions: ['skipIf(isJSDOM)', 'skipIf(reactMajor < 19 || !isBlink)'] },
        ],
      },
    ],
  });
  const rows = { [VASE_FILE]: [{ ...first, conditions: ['skipIf(!isBlink)'] }] };
  assert.deepEqual(run([], { extract, paths: [VASE_FILE], rows }).problems, []);
});

test('an engine row that covers no added condition is stale, and it does not cover a row with no match', () => {
  const rows = { [VASE_FILE]: [first, second, suite] };
  assert.deepEqual(run([engineRow], { paths: [VASE_FILE], rows }).problems, [
    `sample: stale row exceptions[0] (${UPSTREAM_FILE}, case "a > first"): it covers no matched row with an added condition. Remove the row.`,
  ]);
  const unmatched = run([engineRow], {
    paths: [VASE_FILE],
    rows: { [VASE_FILE]: [second, suite] },
  });
  assert.equal(
    unmatched.problems.some((problem) => problem.includes('uncovered case "a > first"')),
    true,
  );
});

const staleRows: { name: string; exceptions: ExceptionRow[]; message: RegExp }[] = [
  {
    name: 'a file that the extract does not have',
    exceptions: [row({ upstream: 'packages/utils/src/none.test.ts', kind: 'not-applicable' })],
    message:
      /stale row exceptions\[0\] \(packages\/utils\/src\/none\.test\.ts\): the extract has nothing that the row names\. Remove the row, or run `pnpm parity:extract --upstream <path> sample` if the family paths changed\./,
  },
  {
    name: 'a block that the extract does not have',
    exceptions: [row({ describe: ['missing'], kind: 'not-applicable' })],
    message: /stale row exceptions\[0\] .*block "missing"\): the extract has nothing/,
  },
  {
    name: 'a case that the extract does not have',
    exceptions: [row({ describe: ['a'], title: 'missing', kind: 'not-applicable' })],
    message: /stale row exceptions\[0\] .*case "a > missing"\): the extract has nothing/,
  },
  {
    name: 'a suite call that the extract does not have',
    exceptions: [row({ describe: ['a'], suite: 'missing', kind: 'not-applicable' })],
    message: /stale row exceptions\[0\] .*suite call "a > missing"\): the extract has nothing/,
  },
  {
    name: 'a replaced row with a test file that does not exist',
    exceptions: [row({ kind: 'replaced', test: 'packages/vue/src/common/none.test.ts' })],
    message:
      /exceptions\[0\] .*: the "test" file packages\/vue\/src\/common\/none\.test\.ts is not a test file/,
  },
  {
    name: 'a replaced row with a test file that is not a test',
    exceptions: [row({ kind: 'replaced', test: 'packages/vue/src/common/a.ts' })],
    message:
      /exceptions\[0\] .*: the "test" file packages\/vue\/src\/common\/a\.ts is not a test file/,
  },
];

for (const { name, exceptions, message } of staleRows) {
  test(`a problem names ${name}`, () => {
    const result = run(exceptions, { paths: ['packages/vue/src/common/a.ts'] });
    assert.equal(
      result.problems.some((problem) => message.test(problem)),
      true,
      result.problems.join('\n'),
    );
  });
}

test('a row that covers no uncovered row is stale for each kind', () => {
  for (const exception of [
    row({ kind: 'not-applicable' }),
    row({ kind: 'waits-on', waitsOn: LATER }),
    row({ kind: 'replaced', test: OTHER_TEST }),
  ]) {
    const result = run([exception], {
      paths: [VASE_FILE, OTHER_TEST],
      rows: { [VASE_FILE]: [first, second, suite] },
    });
    assert.deepEqual(result.problems, [
      `sample: stale row exceptions[0] (${UPSTREAM_FILE}): it covers no row without a match. Remove the row.`,
    ]);
  }
});

test('rows with the same key pair one to one in source order', () => {
  const extract = makeExtract({
    cases: [{ file: UPSTREAM_FILE, rows: [first, first, first] }],
  });
  const fewer = run([], {
    extract,
    paths: [VASE_FILE],
    rows: { [VASE_FILE]: [first, first] },
  });
  assert.equal(fewer.problems.length, 1);
  assert.match(fewer.problems[0], /uncovered case "a > first"/);
  assert.equal(fewer.summary.cases.matched, 2);
  const more = run([], {
    extract,
    paths: [VASE_FILE],
    rows: { [VASE_FILE]: [first, first, first, first] },
  });
  assert.deepEqual(more.problems, []);
  assert.equal(more.summary.rowsWithoutUpstream, 1);
});

test('a moved suite keeps the original describe path, title, suite calls and engine row', () => {
  const title = 'calls the Base UI handler';
  const describe = ['Base UI point', 'click'];
  const path = 'packages/vue/src/tooltip/Root.point.test.tsx';
  const upstream = { describe, title };
  const local = { describe: ['Vase UI point', 'click'], title: 'calls the Vase UI handler' };
  const conditions = ['skipIf(isBlink)'];
  const options = {
    extract: makeExtract({
      cases: [
        {
          file: UPSTREAM_FILE,
          rows: [{ ...upstream, conditions }, upstream, { describe, suite: 'describeConformance' }],
        },
      ],
    }),
    paths: [path],
    relocations: new Map([[UPSTREAM_FILE, [path]]]),
    rows: {
      [path]: [
        { ...local, conditions },
        { ...local, conditions: ['skipIf(isWebKit)'] },
        { describe: local.describe, suite: 'describeConformance' },
      ],
    },
  };
  const engine = row({ describe, title, kind: 'engine', engine: 'webkit' });
  const covered = run([engine], options);
  assert.deepEqual(covered.problems, []);
  assert.equal(covered.summary.cases.matched, 2);
  assert.equal(covered.summary.cases.engine.webkit, 1);
  assert.equal(covered.summary.suiteCalls.matched, 1);
  assert.match(run([], options).problems.join('\n'), /added condition.*skipIf\(isWebKit\)/);
  options.rows[path][0] = { ...local, conditions, describe: ['Other', 'click'] };
  assert.ok(
    run([engine], options).problems.some((problem) =>
      problem.includes(`uncovered case "Base UI point > click > ${title}" in ${UPSTREAM_FILE}`),
    ),
  );
});

test('a test file with both a .ts and a .tsx counterpart is a problem', () => {
  const result = run([], {
    paths: [VASE_FILE, `${VASE_FILE}x`],
    rows: { [VASE_FILE]: [first, second, suite], [`${VASE_FILE}x`]: [] },
  });
  assert.match(
    result.problems[0],
    /packages\/vue\/src\/common\/a\.test\.ts and packages\/vue\/src\/common\/a\.test\.tsx both match/,
  );
});

test('a split suite helper can retain cases in more than one source file', () => {
  const file = 'packages/react/test/shared.tsx';
  const left = 'packages/vue/test/pointer.ts';
  const right = 'packages/vue/test/keyboard.ts';
  const options = {
    extract: makeExtract({ sources: [file], cases: [{ file, rows: [first, second] }] }),
    paths: [left, right],
    relocations: new Map([[file, [left, right]]]),
    rows: { [left]: [first], [right]: [first, second] },
  };
  const result = run([], options);
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.sources.ported, 1);
  assert.equal(result.summary.cases.matched, 2);
  assert.equal(result.summary.rowsWithoutUpstream, 1);
});

test('a split helper leaves a shared occurrence for a suite with only one destination', () => {
  const file = 'packages/react/test/shared.tsx';
  const other = 'packages/react/test/keyboard.ts';
  const pointer = 'packages/vue/test/pointer.ts';
  const keyboard = 'packages/vue/test/keyboard.ts';
  const options = {
    extract: makeExtract({
      sources: [file, other],
      cases: [
        { file, rows: [first] },
        { file: other, rows: [first] },
      ],
    }),
    paths: [keyboard, pointer],
    relocations: new Map([[file, [keyboard, pointer]]]),
    rows: { [keyboard]: [first], [pointer]: [first] },
  };
  const result = run([], options);
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.cases.matched, 2);
  assert.equal(result.summary.rowsWithoutUpstream, 0);
});

test('a split helper compares duplicate guards in the file that retains each case', () => {
  const file = 'packages/react/test/shared.tsx';
  const left = 'packages/vue/test/pointer.ts';
  const right = 'packages/vue/test/keyboard.ts';
  const blink = { ...first, conditions: ['skipIf(isBlink)'] };
  const webkit = { ...first, conditions: ['skipIf(isWebKit)'] };
  const options = {
    extract: makeExtract({ sources: [file], cases: [{ file, rows: [blink, webkit] }] }),
    paths: [left, right],
    relocations: new Map([[file, [left, right]]]),
    rows: { [left]: [webkit], [right]: [blink] },
  };
  assert.deepEqual(run([], options).problems, []);
  options.rows[right] = [webkit];
  assert.match(run([], options).problems.join('\n'), /added condition.*skipIf\(isWebKit\)/);
});

const SOURCE = 'packages/utils/src/clamp.ts';
const sourceExtract = makeExtract({ sources: [SOURCE], cases: [] });

test('a source file with a counterpart and no row is ported', () => {
  const result = run([], { extract: sourceExtract, paths: ['packages/vue/src/common/clamp.ts'] });
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.sources.ported, 1);
});

test('a source file with a .vue counterpart is ported', () => {
  const result = run([], { extract: sourceExtract, paths: ['packages/vue/src/common/clamp.vue'] });
  assert.deepEqual(result.problems, []);
});

test('a source file with neither a counterpart nor a row is a problem', () => {
  const result = run([], { extract: sourceExtract });
  assert.deepEqual(result.problems, [
    `sample: uncovered source file ${SOURCE}: Vase UI has no counterpart. Port the file, or add an exception row.`,
  ]);
});

test('a source file with a counterpart and a row is a problem', () => {
  const result = run([row({ upstream: SOURCE, kind: 'not-applicable' })], {
    extract: sourceExtract,
    paths: ['packages/vue/src/common/clamp.ts'],
  });
  assert.deepEqual(result.problems, [
    `sample: stale row exceptions[0] (${SOURCE}): Vase UI has the counterpart packages/vue/src/common/clamp.ts. Remove the row.`,
  ]);
});

test('a source file with a row and no counterpart passes, and the row waits for the file itself', () => {
  for (const kind of ['not-applicable', 'waits-on'] as const) {
    const result = run([row({ upstream: SOURCE, kind })], { extract: sourceExtract });
    assert.deepEqual(result.problems, []);
    assert.equal(result.summary.sources[kind], 1);
  }
});

const TYPE_TEST = 'packages/utils/src/clamp.spec.ts';
const typeTestExtract = makeExtract({ typeTests: [TYPE_TEST], cases: [] });

test('a type test follows the rules of a source file', () => {
  assert.deepEqual(
    run([], { extract: typeTestExtract, paths: ['packages/vue/src/common/clamp.spec.ts'] })
      .problems,
    [],
  );
  assert.equal(run([], { extract: typeTestExtract }).problems.length, 1);
  assert.equal(
    run([row({ upstream: TYPE_TEST, kind: 'not-applicable' })], {
      extract: typeTestExtract,
      paths: ['packages/vue/src/common/clamp.spec.ts'],
    }).problems.length,
    1,
  );
});

test('a waits-on row of a type test is valid only while its target has no counterpart', () => {
  const exceptions = [row({ upstream: TYPE_TEST, kind: 'waits-on', waitsOn: LATER })];
  assert.deepEqual(run(exceptions, { extract: typeTestExtract }).problems, []);
  assert.equal(
    run(exceptions, { extract: typeTestExtract, paths: ['packages/vue/src/common/later.ts'] })
      .problems.length,
    1,
  );
});

test('a replaced row of a type test needs a test file that exists', () => {
  const exceptions = [row({ upstream: TYPE_TEST, kind: 'replaced', test: OTHER_TEST })];
  assert.equal(run(exceptions, { extract: typeTestExtract }).problems.length, 1);
  assert.deepEqual(run(exceptions, { extract: typeTestExtract, paths: [OTHER_TEST] }).problems, []);
});
