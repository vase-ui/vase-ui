import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import type { TestRow } from '../parity/cases.ts';
import type { FileTally, RowTally } from '../parity/checkFamily.ts';
import type { FamilyReport } from '../parity/checkRepository.ts';
import type {
  BetterRow,
  ExceptionRow,
  FamilyExtract,
  FamilyFile,
  UpstreamCommit,
  UpstreamFile,
} from '../parity/parityFiles.ts';
import { DOCS_FOLDER_PREFIX, vaseFiles } from '../parity/paths.ts';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { buildParityReport, loadParityReport, readScope } from './parityReport.ts';
import type { Change, ParityReport, ReportInput, ScopeFile } from './parityReport.ts';

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
  components: ['alpha', 'dialog', 'select'],
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
  notPorted: [
    {
      what: 'a thing',
      upstream: ['packages/react/src/thing/**', 'docs/src/app/(docs)/react/components/thing/**'],
      reason: 'A reason.',
    },
  ],
  outOfScope: [
    { paths: ['.github/**'], reason: 'CI and repository automation.' },
    { paths: ['.circleci/**'], reason: 'CI and repository automation.' },
    {
      paths: ['docs/**'],
      except: ['docs/src/app/(docs)/react/components/*/**'],
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
  returnTypeDifferences: [],
  notApplicableCommits: [],
};

const beta: FamilyFile = {
  upstreamPaths: ['packages/react/src/beta/**'],
  matchedCommit: FOURTH,
  exceptions: [],
  surfaceAdditions: [],
  returnTypeDifferences: [],
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
    ownComponents: [],
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

const NOT_PORTED_FILE = 'packages/react/src/thing/Thing.tsx';

function otherOfCommit(...paths: string[]): Change['other'] {
  const sha = '9'.repeat(40);
  const commits = [commit(sha, '2026-02-01T10:00:00+00:00', ...paths)];
  const report = buildParityReport(makeInput({ upstream: { ...upstream, commits }, families: [] }));
  return changeOf(report, sha).other;
}

test('a commit with only paths of a notPorted row is out-of-scope with the reason of the row', () => {
  assert.deepEqual(otherOfCommit(NOT_PORTED_FILE, 'packages/react/src/thing/Thing.test.tsx'), {
    state: 'out-of-scope',
    reasons: ['A reason.'],
  });
});

test('a commit with a path of a notPorted row and an out-of-scope path has the two reasons', () => {
  assert.deepEqual(otherOfCommit(NOT_PORTED_FILE, '.github/workflows/ci.yml'), {
    state: 'out-of-scope',
    reasons: ['CI and repository automation.', 'A reason.'],
  });
});

test('a commit with a path of a notPorted row and a path that no family has is not-started', () => {
  assert.deepEqual(otherOfCommit(NOT_PORTED_FILE, 'packages/react/src/dialog/Dialog.tsx'), {
    state: 'not-started',
  });
});

test('a docs path of a notPorted row has no reason of the rule that keeps it in scope', () => {
  assert.deepEqual(otherOfCommit('docs/src/app/(docs)/react/components/thing/page.mdx'), {
    state: 'out-of-scope',
    reasons: ['A reason.'],
  });
});

function statesOfSinglePathCommits(paths: string[]): (path: string) => Change['other'] {
  const shaOf = (path: string): string => String(paths.indexOf(path)).padStart(40, '0');
  const commits = paths.map((path) => commit(shaOf(path), '2026-02-01T10:00:00+00:00', path));
  const report = buildParityReport(
    makeInput({
      upstream: { ...upstream, commits },
      families: [],
      scope: readScope(REPOSITORY_ROOT),
    }),
  );
  return (path) => changeOf(report, shaOf(path)).other;
}

test('a root file, a settings file and an overview page have one reason, and a source file is not started', () => {
  const oneReason = [
    'LICENSE',
    '.gitignore',
    'package.json',
    'renovate.json',
    '.vscode/settings.json',
    'docs/src/app/(docs)/react/overview/quick-start/page.mdx',
  ];
  const sourceFile = 'packages/react/src/dialog/Dialog.tsx';
  const stateOf = statesOfSinglePathCommits([...oneReason, sourceFile]);
  for (const path of oneReason) {
    const other = stateOf(path);
    assert.ok(other?.state === 'out-of-scope', path);
    assert.equal(other.reasons.length, 1, path);
  }
  assert.deepEqual(stateOf(sourceFile), { state: 'not-started' });
});

test('the index page of a page group has one reason, and each file of a page folder is not started', () => {
  const groupFolders = ['components', 'utils', 'handbook'].map(
    (group) => DOCS_FOLDER_PREFIX + group,
  );
  const indexPages = groupFolders.map((folder) => `${folder}/page.mdx`);
  const pageFiles = groupFolders.flatMap((folder) => [
    `${folder}/a-page/page.mdx`,
    `${folder}/a-page/demos/hero/css-modules/index.tsx`,
  ]);
  const stateOf = statesOfSinglePathCommits([...indexPages, ...pageFiles]);
  for (const path of indexPages) {
    const other = stateOf(path);
    assert.ok(other?.state === 'out-of-scope', path);
    assert.equal(other.reasons.length, 1, path);
  }
  for (const path of pageFiles) {
    assert.deepEqual(stateOf(path), { state: 'not-started' }, path);
  }
});

test('a temporal adapter, a file of its shared suite and the barrel of the package have one reason', () => {
  const notPorted = [
    'packages/react/src/internals/temporal/temporal.ts',
    'packages/react/src/internals/temporal-adapter-date-fns/TemporalAdapterDateFns.ts',
    'packages/react/src/internals/temporal-adapter-luxon/TemporalAdapterLuxon.test.ts',
    'packages/react/test/describeGregorianAdapter/testComputations.ts',
    'packages/react/src/index.ts',
  ];
  const stateOf = statesOfSinglePathCommits(notPorted);
  for (const path of notPorted) {
    const other = stateOf(path);
    assert.ok(other?.state === 'out-of-scope', path);
    assert.equal(other.reasons.length, 1, path);
  }
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

test('the status counts the complete components and names the components that no family names', () => {
  const { status } = buildParityReport(makeInput());
  assert.deepEqual(status, { done: 1, total: 3, notStarted: ['dialog', 'select'] });
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

test('a case that a Vase UI test replaces is covered, as a matched case is, and a not-applicable case is not', () => {
  const alphaReport = makeFamilyReport('alpha');
  const cases = { ...rowTally(9), matched: 0, replaced: 7, 'not-applicable': 2 };
  const onlyReplaced = { ...alphaReport, summary: { ...alphaReport.summary, cases } };
  const report = buildParityReport(
    makeInput({
      check: { ...makeInput().check, families: [onlyReplaced, makeFamilyReport('beta')] },
    }),
  );
  const [alphaEntry, betaEntry] = report.families;
  assert.equal(alphaEntry.coveredCases, 7);
  assert.equal(betaEntry.coveredCases, 9);
});

test('the Vase UI tests of a family are the cases of each file that holds or replaces its cases, once', () => {
  const testFile = 'packages/react/src/alpha/Alpha.test.tsx';
  const replacedFile = 'packages/react/src/alpha/useAlpha.test.tsx';
  const typeTest = 'packages/react/src/alpha/Alpha.spec.tsx';
  const counterpart = 'packages/vue/src/alpha/Alpha.test.ts';
  const replacement = 'packages/vue/src/alpha/state.test.ts';
  const typeReplacement = 'packages/vue/src/alpha/Alpha.spec.ts';
  const replaced = (upstream: string, test: string): ExceptionRow => ({
    upstream,
    kind: 'replaced',
    test,
    reason: 'A Vase UI test covers it.',
  });
  const extract: FamilyExtract = {
    commit: SECOND,
    upstreamPaths: alpha.upstreamPaths,
    sources: [],
    typeTests: [typeTest],
    cases: [
      { file: testFile, rows: [{ describe: [], title: 'renders' }] },
      {
        file: replacedFile,
        rows: [
          { describe: [], title: 'changes' },
          { describe: [], title: 'resets' },
        ],
      },
    ],
    surface: [],
    pages: [],
  };
  const exceptions = [
    { ...replaced(replacedFile, replacement), describe: [], title: 'changes' },
    { ...replaced(replacedFile, counterpart), describe: [], title: 'resets' },
    replaced(typeTest, typeReplacement),
  ];
  const rows: Record<string, TestRow[]> = {
    [counterpart]: [
      { describe: ['<Alpha />'], title: 'renders' },
      { describe: ['<Alpha />'], title: 'opens' },
      { describe: ['<Alpha />'], suite: 'describeConformance' },
    ],
    [replacement]: [{ describe: [], title: 'changes' }],
    [typeReplacement]: [{ describe: [], title: 'types' }],
  };
  const report = buildParityReport(
    makeInput({
      families: [{ ...familyFiles('alpha', { ...alpha, exceptions }), extract }],
      files: vaseFiles([counterpart, replacement, typeReplacement]),
      rowsOf: (path) => rows[path] ?? [],
    }),
  );
  assert.equal(report.families[0].vaseTests, 3);
});

test('a return type difference keeps its entry, its type and its reason', () => {
  const row = { entry: 'useAlpha', returns: 'ComputedRef<number>', reason: 'A reason.' };
  const report = buildParityReport(
    makeInput({
      families: [familyFiles('alpha', { ...alpha, returnTypeDifferences: [row] })],
    }),
  );
  assert.deepEqual(report.families[0].returnTypeDifferences, [row]);
});

test('the report lists each own component with its reason and its standard, and counts no component of it', () => {
  const ownComponents = [
    {
      name: 'gamma',
      record: {
        standard: ['https://example.com/pattern', 'https://example.com/role'],
        reason: 'Base UI has no gamma.',
        parts: ['Root'],
      },
    },
  ];
  const report = buildParityReport(makeInput({ ownComponents }));
  assert.deepEqual(report.ownComponents, [
    {
      name: 'gamma',
      reason: 'Base UI has no gamma.',
      standard: ['https://example.com/pattern', 'https://example.com/role'],
    },
  ]);
  assert.deepEqual(report.status, buildParityReport(makeInput()).status);
  assert.deepEqual(buildParityReport(makeInput()).ownComponents, []);
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

function makeParityRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'parity-report-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test('loadParityReport throws when the check finds a problem', () => {
  const root = makeParityRoot({
    'parity/upstream.json': JSON.stringify(upstream),
    'parity/families/alpha.json': JSON.stringify(alpha),
  });
  assert.throws(
    () => loadParityReport(root),
    /^Error: The parity report needs a clean parity check\. Run `pnpm parity:check`[^\n]*\nalpha: parity\/families\/alpha\.upstream\.json does not exist/,
  );
});

test('loadParityReport gives the own components that it reads from parity/own', () => {
  const report = loadParityReport(join(import.meta.dirname, '..', 'parity', 'fixtures'));
  assert.deepEqual(report.ownComponents, [
    {
      name: 'sample',
      reason: 'Base UI has no sample component.',
      standard: ['https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'],
    },
  ]);
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
    assert.throws(() => readScope(makeParityRoot({ 'parity/scope.json': text })), message);
  });
}
