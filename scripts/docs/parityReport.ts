import { isSuiteRow } from '../parity/cases.ts';
import type { TestRow } from '../parity/cases.ts';
import { runParityCheck } from '../parity/check.ts';
import type { FileTally, RowTally } from '../parity/checkFamily.ts';
import { checkBetter } from '../parity/checkRepository.ts';
import type { CheckResult, FamilyReport } from '../parity/checkRepository.ts';
import type { SurfaceSummary } from '../parity/checkSurface.ts';
import { labelOf, memberOf, targetOf } from '../parity/parityFiles.ts';
import type {
  BetterRow,
  Engine,
  ExceptionKind,
  ExceptionRow,
  FamilyFile,
  MemberKind,
  ReturnTypeDifference,
  UpstreamFile,
} from '../parity/parityFiles.ts';
import { isTestFile, isUnderMappedRoot, matchesAny } from '../parity/paths.ts';
import type { VaseFiles } from '../parity/paths.ts';
import { readRepositoryFile, REPOSITORY_ROOT } from '../parity/repository.ts';
import type { FamilyFiles } from '../parity/repository.ts';
import { array, nonEmptyString, object, problemsOf } from '../parity/validate.ts';
import { countComponents, isComponentFamily } from './components.ts';
import { renderStatusLine } from './status.ts';

export type CommitState = 'mirrored' | 'queued' | 'not-applicable';

export interface ParityReport {
  upstream: { commit: string; describe: string; release: string; date: string };
  status: { done: number; total: number; notStarted: string[]; line: string };
  families: FamilyEntry[];
  changes: Change[];
  edgeCases: EdgeCase[];
  notPorted: { what: string; reason: string }[];
}

export interface FamilyEntry {
  name: string;
  isComponent: boolean;
  matchedCommit: { sha: string; date: string };
  sources: FileTally;
  typeTests: FileTally;
  cases: RowTally;
  suiteCalls: RowTally;
  rowsWithoutUpstream: number;
  surface?: SurfaceSummary;
  exceptions: {
    thing: string;
    kind: ExceptionKind;
    reason: string;
    test?: string;
    engine?: Engine;
    link?: string;
    waitsOn?: string;
  }[];
  surfaceAdditions: { entry: string; kind: MemberKind; name: string; reason: string }[];
  returnTypeDifferences: ReturnTypeDifference[];
  queued: { count: number; oldest?: string };
}

export interface Change {
  sha: string;
  date: string;
  subject: string;
  families: { name: string; state: CommitState; reason?: string }[];
  /** Only when `families` is empty. */
  other?: { state: 'not-started' } | { state: 'out-of-scope'; reasons: string[] };
}

export interface EdgeCase {
  id: string;
  behavior: string;
  evidence: string[];
  dueWith: string;
  due: boolean;
  tests: { file: string; title: string }[];
}

export interface ScopeFile {
  notPorted: { what: string; upstream: string[]; reason: string }[];
  outOfScope: { paths: string[]; except?: string[]; reason: string }[];
}

export interface ReportInput {
  upstream: UpstreamFile;
  families: FamilyFiles[];
  better: BetterRow[];
  check: CheckResult;
  scope: ScopeFile;
  files: VaseFiles;
  rowsOf: (path: string) => TestRow[];
}

const SCOPE_FILE = 'parity/scope.json';

const scopeFile = object({
  notPorted: array(
    object({
      what: nonEmptyString,
      upstream: array(nonEmptyString, { nonEmpty: true }),
      reason: nonEmptyString,
    }),
  ),
  outOfScope: array(
    object(
      {
        paths: array(nonEmptyString, { nonEmpty: true }),
        except: array(nonEmptyString, { nonEmpty: true }),
        reason: nonEmptyString,
      },
      ['except'],
    ),
  ),
});

export function readScope(root: string): ScopeFile {
  let value: unknown;
  try {
    value = JSON.parse(readRepositoryFile(root, SCOPE_FILE));
  } catch (error) {
    throw new Error(`${SCOPE_FILE}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  const problems = problemsOf(SCOPE_FILE, scopeFile, value);
  if (problems.length > 0) {
    throw new Error(problems.join('\n'));
  }
  return value as ScopeFile;
}

function utcDay(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function otherOf(paths: string[], scope: ScopeFile): NonNullable<Change['other']> {
  const isNotStarted = paths.some(
    (path) =>
      isUnderMappedRoot(path) ||
      scope.outOfScope.some((rule) => matchesAny(path, rule.except ?? [])),
  );
  if (isNotStarted) {
    return { state: 'not-started' };
  }
  const reasons = scope.outOfScope
    .filter((rule) => paths.some((path) => matchesAny(path, rule.paths)))
    .map((rule) => rule.reason);
  return { state: 'out-of-scope', reasons: [...new Set(reasons)] };
}

interface FamilyInput {
  name: string;
  family: FamilyFile;
  report: FamilyReport;
  /** The position of `matchedCommit` in the commits of the upstream file. */
  matchedIndex: number;
}

/** The result lists the newest commit first. */
function changesOf(upstream: UpstreamFile, families: FamilyInput[], scope: ScopeFile): Change[] {
  const changes = upstream.commits.map((commit, index): Change => {
    const touched = families.flatMap(({ name, family, matchedIndex }): Change['families'] => {
      if (!commit.paths.some((path) => matchesAny(path, family.upstreamPaths))) {
        return [];
      }
      const notApplicable = family.notApplicableCommits.find(({ sha }) => sha === commit.sha);
      if (notApplicable) {
        return [{ name, state: 'not-applicable', reason: notApplicable.reason }];
      }
      return [{ name, state: index <= matchedIndex ? 'mirrored' : 'queued' }];
    });
    return {
      sha: commit.sha,
      date: utcDay(commit.date),
      subject: commit.subject,
      families: touched,
      ...(touched.length === 0 ? { other: otherOf(commit.paths, scope) } : {}),
    };
  });
  return changes.reverse();
}

function exceptionsOf(rows: ExceptionRow[]): FamilyEntry['exceptions'] {
  return rows.flatMap((row) => {
    const target = targetOf(row);
    return target
      ? [
          {
            thing: labelOf(target),
            kind: row.kind,
            reason: row.reason,
            test: row.test,
            engine: row.engine,
            link: row.link,
            waitsOn: row.waitsOn,
          },
        ]
      : [];
  });
}

function familyEntryOf(
  { name, family, report, matchedIndex }: FamilyInput,
  upstream: UpstreamFile,
  changes: Change[],
): FamilyEntry {
  const { summary, surface } = report;
  // `changes` is newest first, so the last queued change is the oldest.
  const queued = changes.filter((change) =>
    change.families.some((touched) => touched.name === name && touched.state === 'queued'),
  );
  const matched = upstream.commits[matchedIndex];
  return {
    name,
    isComponent: isComponentFamily(family),
    matchedCommit: { sha: matched.sha, date: utcDay(matched.date) },
    sources: summary.sources,
    typeTests: summary.typeTests,
    cases: summary.cases,
    suiteCalls: summary.suiteCalls,
    rowsWithoutUpstream: summary.rowsWithoutUpstream,
    surface,
    exceptions: exceptionsOf(family.exceptions),
    surfaceAdditions: family.surfaceAdditions.map((row) => ({
      entry: row.entry,
      ...memberOf(row),
      reason: row.reason,
    })),
    returnTypeDifferences: family.returnTypeDifferences,
    queued: { count: queued.length, oldest: queued.at(-1)?.date },
  };
}

function edgeCasesOf(
  better: BetterRow[],
  files: VaseFiles,
  rowsOf: (path: string) => TestRow[],
): EdgeCase[] {
  const testFiles = [...files.paths].filter(isTestFile).sort();
  return better
    .map((row): EdgeCase => {
      const due = checkBetter([row], files, () => []).summary.due === 1;
      // `checkBetter` accepts a test when the id is in its title or in the title of a block around it.
      const tests = due
        ? testFiles.flatMap((file) =>
            rowsOf(file).flatMap((testRow) =>
              !isSuiteRow(testRow) &&
              checkBetter([row], files, () => [testRow]).problems.length === 0
                ? [{ file, title: [...testRow.describe, testRow.title].join(' > ') }]
                : [],
            ),
          )
        : [];
      return {
        id: row.id,
        behavior: row.behavior,
        evidence: row.evidence,
        dueWith: row.dueWith,
        due,
        tests,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export function buildParityReport(input: ReportInput): ParityReport {
  const { upstream, check, scope } = input;
  const shas = upstream.commits.map(({ sha }) => sha);
  const familyFiles = new Map(input.families.map(({ name, family }) => [name, family]));
  const families = check.families.flatMap((report): FamilyInput[] => {
    const family = familyFiles.get(report.name);
    return family
      ? [{ name: report.name, family, report, matchedIndex: shas.indexOf(family.matchedCommit) }]
      : [];
  });
  const changes = changesOf(upstream, families, scope);
  const counts = countComponents(input.families, upstream.components);
  return {
    upstream: {
      commit: upstream.commit,
      describe: upstream.describe,
      release: upstream.release,
      date: utcDay(upstream.commits[upstream.commits.length - 1].date),
    },
    status: { ...counts, line: renderStatusLine(counts) },
    families: families.map((family) => familyEntryOf(family, upstream, changes)),
    changes,
    edgeCases: edgeCasesOf(input.better, input.files, input.rowsOf),
    notPorted: scope.notPorted.map(({ what, reason }) => ({ what, reason })),
  };
}

/** Runs the check of `pnpm parity:check` and builds the data of the parity page. It throws when the check finds a problem. */
export function loadParityReport(root = REPOSITORY_ROOT): ParityReport {
  const { parity, files, rowsOf, result } = runParityCheck(root);
  const { upstream } = parity;
  if (result.problems.length > 0 || upstream === undefined) {
    throw new Error(
      [
        'The parity page needs a clean parity check. Run `pnpm parity:check` and correct each problem.',
        ...result.problems,
      ].join('\n'),
    );
  }
  return buildParityReport({
    upstream,
    families: parity.families,
    better: parity.better,
    check: result,
    scope: readScope(root),
    files,
    rowsOf,
  });
}
