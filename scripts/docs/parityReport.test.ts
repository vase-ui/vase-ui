import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { TestRow } from '../parity/cases.ts';
import type { FileTally, RowTally } from '../parity/checkFamily.ts';
import type { FamilyReport } from '../parity/checkRepository.ts';
import type {
  BetterRow,
  ExceptionRow,
  FamilyFile,
  UpstreamCommit,
  UpstreamFile,
} from '../parity/parityFiles.ts';
import { vaseFiles } from '../parity/paths.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { buildParityReport, loadParityReport, readScope } from './parityReport.ts';
import type { ParityReport, ReportInput, ScopeFile } from './parityReport.ts';
import { renderStatusLine } from './status.ts';

const [FIRST, SECOND, THIRD, FOURTH, CI, UNPORTED, UNPORTED_DOCS, ROOT_FILE] = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  '1',
  '2',
].map((digit) => digit.repeat(40));

function commit(sha: string, date: string, ...paths: string[]): UpstreamCommit {
  return { sha, date, subject: `Subject of ${sha.slice(0, 7)}`, paths };
}

const upstream: UpstreamFile = {
  commit: ROOT_FILE,
  describe: 'v1.0.0-8-g2222222',
  release: '1.0.0',
  commits: [
    commit(FIRST, '2026-01-01T10:00:00+00:00', 'packages/react/src/alpha/Alpha.tsx'),
    commit(SECOND, '2026-01-02T10:00:00+00:00', 'packages/react/src/alpha/index.ts'),
    // The date is the day before in UTC.
    commit(
      THIRD,
      '2026-01-04T01:30:00+03:00',
      'packages/react/src/alpha/Alpha.test.tsx',
      'packages/react/src/beta/Beta.tsx',
    ),
    commit(FOURTH, '2026-01-05T10:00:00+00:00', 'packages/react/src/alpha/useAlpha.ts'),
    commit(CI, '2026-01-06T10:00:00+00:00', '.github/workflows/ci.yml', '.circleci/config.yml'),
    commit(UNPORTED, '2026-01-07T10:00:00+00:00', 'packages/react/src/dialog/Dialog.tsx'),
    commit(
      UNPORTED_DOCS,
      '2026-01-08T10:00:00+00:00',
      'docs/src/app/(docs)/react/components/dialog/page.mdx',
    ),
    commit(ROOT_FILE, '2026-01-09T10:00:00+00:00', 'LICENSE'),
  ],
};

const scope: ScopeFile = {
  notPorted: [{ what: 'a thing', upstream: ['packages/react/src/thing/**'], reason: 'A reason.' }],
  outOfScope: [
    { paths: ['.github/**'], reason: 'CI and repository automation.' },
    { paths: ['.circleci/**'], reason: 'CI and repository automation.' },
    {
      paths: ['docs/**'],
      except: ['docs/src/app/(docs)/react/components/**'],
      reason: 'The docs site.',
    },
  ],
};

const REACT_ONLY = 'Only React has the thing.';

const alpha: FamilyFile = {
  upstreamPaths: ['packages/react/src/alpha/**', 'docs/src/app/(docs)/react/components/alpha/**'],
  matchedCommit: SECOND,
  exceptions: [],
  surfaceAdditions: [],
  notApplicableCommits: [],
};

const beta: FamilyFile = {
  upstreamPaths: ['packages/react/src/beta/**'],
  matchedCommit: FOURTH,
  exceptions: [],
  surfaceAdditions: [],
  notApplicableCommits: [{ sha: THIRD, reason: REACT_ONLY }],
};

function familyFiles(name: string, family: FamilyFile): FamilyFiles {
  return { name, family, hasFamilyFile: true, hasExtract: true };
}

const fileTally = (total: number): FileTally => ({
  total,
  ported: total,
  replaced: 0,
  'not-applicable': 0,
  'waits-on': 0,
});

const rowTally = (total: number): RowTally => ({
  total,
  matched: total,
  replaced: 0,
  'not-applicable': 0,
  'waits-on': 0,
  engine: { chromium: 0, firefox: 0, webkit: 0 },
});

function makeFamilyReport(name: string): FamilyReport {
  return {
    name,
    summary: {
      name,
      sources: fileTally(3),
      typeTests: fileTally(1),
      cases: rowTally(9),
      suiteCalls: rowTally(1),
      rowsWithoutUpstream: 4,
    },
  };
}

function makeInput(changes: Partial<ReportInput> = {}): ReportInput {
  return {
    upstream,
    families: [familyFiles('alpha', alpha), familyFiles('beta', beta)],
    better: [],
    check: {
      problems: [],
      families: [makeFamilyReport('alpha'), makeFamilyReport('beta')],
      better: { total: 0, due: 0 },
    },
    scope,
    files: vaseFiles([]),
    rowsOf: () => {
      throw new Error('This report must not read a test file.');
    },
    ...changes,
  };
}

function changeOf(report: ParityReport, sha: string) {
  const found = report.changes.find((change) => change.sha === sha);
  assert.ok(found, `The report has no change ${sha}.`);
  return found;
}

test('a commit at the matched commit and a commit before it are mirrored', () => {
  const report = buildParityReport(makeInput());
  assert.deepEqual(changeOf(report, FIRST).families, [{ name: 'alpha', state: 'mirrored' }]);
  assert.deepEqual(changeOf(report, SECOND).families, [{ name: 'alpha', state: 'mirrored' }]);
});

test('a commit after the matched commit is queued, and the family has the count and the oldest date', () => {
  const report = buildParityReport(makeInput());
  assert.deepEqual(changeOf(report, FOURTH).families, [{ name: 'alpha', state: 'queued' }]);
  const [alphaEntry, betaEntry] = report.families;
  assert.deepEqual(alphaEntry.queued, { count: 2, oldest: '2026-01-03' });
  assert.equal(betaEntry.queued.count, 0);
  assert.equal(betaEntry.queued.oldest, undefined);
});

test('a listed commit is not-applicable with its reason, and it is not queued', () => {
  const { families } = changeOf(buildParityReport(makeInput()), THIRD);
  assert.deepEqual(families, [
    { name: 'alpha', state: 'queued' },
    { name: 'beta', state: 'not-applicable', reason: REACT_ONLY },
  ]);
});

test('a commit with only out-of-scope paths is out-of-scope with the distinct reasons', () => {
  const change = changeOf(buildParityReport(makeInput()), CI);
  assert.deepEqual(change.families, []);
  assert.deepEqual(change.other, {
    state: 'out-of-scope',
    reasons: ['CI and repository automation.'],
  });
});

for (const { name, sha } of [
  { name: 'a path in a folder that no family has', sha: UNPORTED },
  { name: 'a docs path that the scope keeps', sha: UNPORTED_DOCS },
]) {
  test(`a commit with ${name} is not-started`, () => {
    const change = changeOf(buildParityReport(makeInput()), sha);
    assert.deepEqual(change.families, []);
    assert.deepEqual(change.other, { state: 'not-started' });
  });
}

test('a commit that no rule names is out-of-scope with no reason', () => {
  assert.deepEqual(changeOf(buildParityReport(makeInput()), ROOT_FILE).other, {
    state: 'out-of-scope',
    reasons: [],
  });
});

test('a commit that touches a family has no other state', () => {
  assert.equal(changeOf(buildParityReport(makeInput()), FIRST).other, undefined);
});

test('the changes list the newest commit first', () => {
  const report = buildParityReport(makeInput());
  assert.deepEqual(
    report.changes.map(({ sha }) => sha),
    [...upstream.commits].reverse().map(({ sha }) => sha),
  );
});

test('a date is the UTC day of the commit', () => {
  const report = buildParityReport(makeInput());
  assert.equal(changeOf(report, THIRD).date, '2026-01-03');
  assert.equal(report.families[1].matchedCommit.date, '2026-01-05');
  assert.equal(report.upstream.date, '2026-01-09');
});

test('the status counts the complete components', () => {
  const { status } = buildParityReport(makeInput());
  const counts = { done: 1, total: status.total };
  assert.deepEqual(status, { ...counts, line: renderStatusLine(counts) });
});

test('an exception row keeps its kind, its reason and the label of the thing', () => {
  const row: ExceptionRow = {
    upstream: 'packages/react/src/alpha/Alpha.test.tsx',
    describe: ['<Alpha />'],
    title: 'renders',
    kind: 'engine',
    engine: 'webkit',
    link: 'https://example.com/bug',
    reason: 'A browser bug.',
  };
  const report = buildParityReport(
    makeInput({ families: [familyFiles('alpha', { ...alpha, exceptions: [row] })] }),
  );
  assert.deepEqual(report.families[0].exceptions, [
    {
      thing: 'packages/react/src/alpha/Alpha.test.tsx, case "<Alpha /> > renders"',
      kind: 'engine',
      reason: 'A browser bug.',
      test: undefined,
      engine: 'webkit',
      link: 'https://example.com/bug',
      waitsOn: undefined,
    },
  ]);
});

function betterRow(id: string): BetterRow {
  return {
    id,
    evidence: ['https://example.com/issue'],
    behavior: 'A thing happens.',
    dueWith: 'packages/utils/src/useControlled.ts',
  };
}

test('a row of parity/better that is not due has no test, even when a title holds its id', () => {
  const testFile = 'packages/vue/src/common/useControlled.test.ts';
  const report = buildParityReport(
    makeInput({
      better: [betterRow('VUE-1')],
      files: vaseFiles([testFile]),
      rowsOf: () => [{ describe: [], title: 'VUE-1: a title with the id' }],
    }),
  );
  assert.equal(report.edgeCases[0].due, false);
  assert.deepEqual(report.edgeCases[0].tests, []);
});

test('a due row lists the cases whose title or block title holds its id, and not a longer id', () => {
  const testFile = 'packages/vue/src/common/useControlled.test.ts';
  const rows: TestRow[] = [
    { describe: ['useControlled', 'VUE-1'], title: 'stays undefined' },
    { describe: [], title: 'VUE-10 is another row' },
    { describe: ['useControlled'], title: 'VUE-1: a bare attribute' },
    { describe: ['useControlled'], title: 'has no id' },
    { describe: ['VUE-1'], suite: 'describeConformance' },
  ];
  const report = buildParityReport(
    makeInput({
      better: [betterRow('VUE-1'), betterRow('VUE-10')],
      files: vaseFiles(['packages/vue/src/common/useControlled.ts', testFile]),
      rowsOf: (path) => (path === testFile ? rows : []),
    }),
  );
  const [first, second] = report.edgeCases;
  assert.equal(first.id, 'VUE-1');
  assert.equal(first.due, true);
  assert.deepEqual(first.tests, [
    { file: testFile, title: 'useControlled > VUE-1 > stays undefined' },
    { file: testFile, title: 'useControlled > VUE-1: a bare attribute' },
  ]);
  assert.equal(second.id, 'VUE-10');
  assert.deepEqual(second.tests, [{ file: testFile, title: 'VUE-10 is another row' }]);
});

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeParityRoot(scopeText?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'parity-report-'));
  roots.push(root);
  mkdirSync(join(root, 'parity'));
  if (scopeText !== undefined) {
    writeFileSync(join(root, 'parity', 'scope.json'), scopeText);
  }
  return root;
}

test('loadParityReport throws when the check finds a problem', () => {
  assert.throws(
    () => loadParityReport(makeParityRoot()),
    /^Error: The parity page needs a clean parity check\. Run `pnpm parity:check`[^\n]*\nparity\/upstream\.json: the file does not exist/,
  );
});

test('readScope accepts parity/scope.json', () => {
  assert.doesNotThrow(() => readScope(REPOSITORY_ROOT));
});

for (const { name, text, message } of [
  {
    name: 'a reason with no text',
    text: '{"notPorted": [{"what": "A thing", "upstream": ["a"], "reason": ""}], "outOfScope": []}',
    message: /^Error: parity\/scope\.json: notPorted\[0\]\.reason: must be a string with text\./,
  },
  { name: 'a file that is not JSON', text: '{', message: /^Error: parity\/scope\.json: / },
]) {
  test(`readScope throws for ${name}`, () => {
    assert.throws(() => readScope(makeParityRoot(text)), message);
  });
}
