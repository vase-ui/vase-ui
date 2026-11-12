import { isSuiteRow } from './cases.ts';
import type { TestRow } from './cases.ts';
import { checkFamily } from './checkFamily.ts';
import type { FamilySummary, FileTally, RowTally } from './checkFamily.ts';
import { checkSurface } from './checkSurface.ts';
import type { SurfaceSummary, Tally } from './checkSurface.ts';
import type { BetterRow, FamilyFile, UpstreamFile } from './parityFiles.ts';
import { hasCounterpart, isTestFile, matchesAny } from './paths.ts';
import type { VaseFiles } from './paths.ts';
import {
  extractCommand,
  extractFile,
  familyFile,
  TRACK_COMMAND,
  UPSTREAM_FILE,
} from './repository.ts';
import type { FamilyFiles, ParityFiles } from './repository.ts';
import type { VaseProject } from './vaseSurface.ts';

export interface BetterSummary {
  total: number;
  due: number;
}

export interface FamilyReport {
  name: string;
  summary: FamilySummary;
  surface?: SurfaceSummary;
}

export interface CheckResult {
  problems: string[];
  families: FamilyReport[];
  better: BetterSummary;
}

export interface CheckInput {
  parity: ParityFiles;
  files: VaseFiles;
  /** The absolute path of the repository root. */
  root: string;
  /** The rows of a Vase UI test file. It throws an error of one line that says what is wrong with the file. */
  rowsOf: (path: string) => TestRow[];
  project: () => VaseProject;
}

function checkCommits(name: string, family: FamilyFile, upstream: UpstreamFile): string[] {
  const problems: string[] = [];
  const shas = upstream.commits.map(({ sha }) => sha);
  const matched = shas.indexOf(family.matchedCommit);
  if (matched === -1) {
    problems.push(
      `${name}: matchedCommit ${family.matchedCommit} is not a commit of ${UPSTREAM_FILE}. Use a commit from that file, or run \`${TRACK_COMMAND}\`.`,
    );
  }
  family.notApplicableCommits.forEach(({ sha }, index) => {
    const place = `notApplicableCommits[${index}] (${sha})`;
    const position = shas.indexOf(sha);
    if (position === -1) {
      problems.push(
        `${name}: ${place}: the commit is not in ${UPSTREAM_FILE}. Use a commit from that file.`,
      );
    } else if (matched !== -1 && position > matched) {
      problems.push(
        `${name}: ${place}: the commit is after matchedCommit. Move matchedCommit forward first.`,
      );
    } else if (
      !upstream.commits[position].paths.some((path) => matchesAny(path, family.upstreamPaths))
    ) {
      problems.push(
        `${name}: ${place}: the commit changes no path of "upstreamPaths". Remove the row.`,
      );
    }
  });
  return problems;
}

function checkFreshExtract(name: string, files: FamilyFiles): string[] {
  const { family, extract } = files;
  if (!family || !extract) {
    return [];
  }
  const rerun = `Run \`${extractCommand(name)}\`.`;
  const problems: string[] = [];
  if (extract.commit !== family.matchedCommit) {
    problems.push(
      `${name}: ${extractFile(name)} was read at commit ${extract.commit}, but matchedCommit is ${family.matchedCommit}. ${rerun}`,
    );
  }
  if (JSON.stringify(extract.upstreamPaths) !== JSON.stringify(family.upstreamPaths)) {
    problems.push(
      `${name}: ${extractFile(name)} was read with other "upstreamPaths" than ${familyFile(name)}. ${rerun}`,
    );
  }
  return problems;
}

/** Checks each due row of `parity/better` for a test with its id. A row is due when its `dueWith` path has a counterpart. */
export function checkBetter(
  rows: BetterRow[],
  files: VaseFiles,
  testRows: () => TestRow[],
): { problems: string[]; summary: BetterSummary } {
  const due = rows.filter((row) => hasCounterpart(row.dueWith, files));
  const problems: string[] = [];
  if (due.length > 0) {
    const titles = testRows().flatMap((row) =>
      isSuiteRow(row) ? [] : [[...row.describe, row.title]],
    );
    for (const row of due) {
      const word = new RegExp(`(?<![\\w-])${row.id}(?![\\w-])`);
      if (!titles.some((list) => list.some((title) => word.test(title)))) {
        problems.push(
          `parity/better/${row.id}.json: due row has no test. Vase UI has the counterpart of ${row.dueWith}. Put ${row.id} in the title of a test or of its describe block.`,
        );
      }
    }
  }
  return { problems, summary: { total: rows.length, due: due.length } };
}

export function checkRepository(input: CheckInput): CheckResult {
  const { parity, files, root } = input;
  const problems = [...parity.problems];
  const families: FamilyReport[] = [];

  // One refused file must not hide the other problems. It gives one problem and has no rows.
  const refused = new Set<string>();
  const rowsOf = (path: string): TestRow[] => {
    if (refused.has(path)) {
      return [];
    }
    try {
      return input.rowsOf(path);
    } catch (error) {
      refused.add(path);
      problems.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  for (const found of [...parity.families].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const { name, family, extract } = found;
    if (found.hasFamilyFile && !found.hasExtract) {
      problems.push(
        `${name}: ${extractFile(name)} does not exist. Run \`${extractCommand(name)}\`.`,
      );
    } else if (!found.hasFamilyFile) {
      problems.push(
        `${name}: ${familyFile(name)} does not exist, but ${extractFile(name)} does. Add the family file, or delete the extract.`,
      );
    }
    if (!family || !extract) {
      continue;
    }
    if (parity.upstream) {
      problems.push(...checkCommits(name, family, parity.upstream));
    }
    const stale = checkFreshExtract(name, found);
    problems.push(...stale);
    if (stale.length > 0) {
      continue;
    }
    const cases = checkFamily(name, family, extract, { files, rowsOf });
    problems.push(...cases.problems);
    const report: FamilyReport = { name, summary: cases.summary };
    if (
      extract.surface.length > 0 ||
      family.surfaceAdditions.length > 0 ||
      family.returnTypeDifferences.length > 0 ||
      family.exceptions.some(({ entry }) => entry !== undefined)
    ) {
      const surface = checkSurface({ name, family, extract, files, root, project: input.project });
      problems.push(...surface.problems);
      report.surface = surface.summary;
    }
    families.push(report);
  }

  const better = checkBetter(parity.better, files, () =>
    [...files.paths]
      .filter(isTestFile)
      .sort()
      .flatMap((path) => rowsOf(path)),
  );
  problems.push(...better.problems);
  return { problems, families, better: better.summary };
}

const EXCEPTION_KINDS = ['replaced', 'not-applicable', 'waits-on'] as const;
const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

function describeCounts(total: number, parts: [string, number][]): string {
  const shown = parts.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`);
  return shown.length > 0 ? `${total} (${shown.join(', ')})` : `${total}`;
}

function fileCounts(tally: FileTally): string {
  return describeCounts(tally.total, [
    ['ported', tally.ported],
    ...EXCEPTION_KINDS.map((kind): [string, number] => [kind, tally[kind]]),
  ]);
}

function rowCounts(tally: RowTally): string {
  return describeCounts(tally.total, [
    ['matched', tally.matched],
    ...EXCEPTION_KINDS.map((kind): [string, number] => [kind, tally[kind]]),
    ...ENGINES.map((engine): [string, number] => [`engine ${engine}`, tally.engine[engine]]),
  ]);
}

function surfaceCounts(tally: Tally): string {
  return describeCounts(tally.total, [
    ['matched', tally.matched],
    ['excepted', tally.excepted],
  ]);
}

export function formatSummary(result: CheckResult): string[] {
  const lines = result.families.map(({ name, summary, surface }) => {
    const segments = [
      `sources ${fileCounts(summary.sources)}`,
      `type tests ${fileCounts(summary.typeTests)}`,
      `cases ${rowCounts(summary.cases)}`,
      `suite calls ${rowCounts(summary.suiteCalls)}`,
      `${summary.rowsWithoutUpstream} Vase UI rows with no upstream row`,
      ...(surface
        ? [
            `entries ${surfaceCounts(surface.entries)}`,
            `prop rows ${surfaceCounts(surface.propRows)}`,
          ]
        : []),
    ];
    return `${name}: ${segments.join('; ')}`;
  });
  lines.push(`parity/better: ${result.better.total} rows, ${result.better.due} due`);
  return lines;
}
