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
    ...overrides,
  };
}

function makeFamily(exceptions: ExceptionRow[] = []): FamilyFile {
  return {
    upstreamPaths: ['packages/utils/src/**'],
    matchedCommit: COMMIT,
    exceptions,
    surfaceAdditions: [],
    notApplicableCommits: [],
  };
}

function row(overrides: Partial<ExceptionRow> & Pick<ExceptionRow, 'kind'>): ExceptionRow {
  return { upstream: UPSTREAM_FILE, reason: 'A reason.', ...overrides };
}

function run(
  exceptions: ExceptionRow[],
  options: { extract?: FamilyExtract; paths?: string[]; rows?: Record<string, TestRow[]> } = {},
) {
  const rows = options.rows ?? {};
  return checkFamily('sample', makeFamily(exceptions), options.extract ?? makeExtract(), {
    files: vaseFiles(options.paths ?? []),
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
    `sample: added condition on case "a > first" in ${VASE_FILE}: Base UI has no condition on it. Remove the condition, or add an "engine" row.`,
  ]);
  const covered = run([engineRow], { paths: [VASE_FILE], rows });
  assert.deepEqual(covered.problems, []);
  assert.equal(covered.summary.cases.engine.webkit, 1);
});

test('a condition that Base UI also has needs no engine row', () => {
  const extract = makeExtract({
    cases: [{ file: UPSTREAM_FILE, rows: [{ ...first, conditions: ['skipIf(isJSDOM)'] }] }],
  });
  const rows = { [VASE_FILE]: [{ ...first, conditions: ['skipIf(isJSDOM)'] }] };
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
