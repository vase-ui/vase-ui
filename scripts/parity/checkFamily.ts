import { checkTitleNames, conditionTerms, isSuiteRow, titlesOf } from './cases.ts';
import type { TestRow } from './cases.ts';
import { isSourceFileTarget, labelOf, targetOf } from './parityFiles.ts';
import type { Engine, FamilyExtract, ExceptionRow, FamilyFile, Target } from './parityFiles.ts';
import { counterparts, hasCounterpart, isTestFile, isTypeTestFile, toVaseName } from './paths.ts';
import type { VaseFiles } from './paths.ts';
import { extractCommand } from './repository.ts';

export interface VaseTree {
  files: VaseFiles;
  rowsOf: (path: string) => TestRow[];
}

type CoveredKind = 'replaced' | 'not-applicable' | 'waits-on';

export interface FileTally {
  total: number;
  ported: number;
  replaced: number;
  'not-applicable': number;
  'waits-on': number;
}

export interface RowTally {
  total: number;
  matched: number;
  replaced: number;
  'not-applicable': number;
  'waits-on': number;
  engine: Record<Engine, number>;
}

export interface FamilySummary {
  name: string;
  sources: FileTally;
  typeTests: FileTally;
  cases: RowTally;
  suiteCalls: RowTally;
  rowsWithoutUpstream: number;
}

export interface FamilyResult {
  problems: string[];
  summary: FamilySummary;
}

interface IndexedRow {
  row: ExceptionRow;
  index: number;
  target: Target;
}

const fileTally = (total: number): FileTally => ({
  total,
  ported: 0,
  replaced: 0,
  'not-applicable': 0,
  'waits-on': 0,
});

const rowTally = (total: number): RowTally => ({
  total,
  matched: 0,
  replaced: 0,
  'not-applicable': 0,
  'waits-on': 0,
  engine: { chromium: 0, firefox: 0, webkit: 0 },
});

function describesRow(row: TestRow): string {
  return isSuiteRow(row)
    ? `suite call "${[...row.describe, row.suite].join(' > ')}"`
    : `case "${[...row.describe, row.title].join(' > ')}"`;
}

function keyOf(row: TestRow, side: 'upstream' | 'vase'): string {
  const titles = titlesOf(row);
  return JSON.stringify([
    isSuiteRow(row) ? row.suite : null,
    side === 'upstream' ? titles.map((title) => toVaseName(title, 'title')) : titles,
  ]);
}

function startsWith(list: string[], prefix: string[]): boolean {
  return prefix.length <= list.length && prefix.every((item, index) => item === list[index]);
}

/** How well a target covers an upstream row. A larger number is more specific. -1 means no cover. */
function coverRank(target: Target, row: TestRow): number {
  switch (target.type) {
    case 'case':
      return !isSuiteRow(row) &&
        row.title === target.title &&
        startsWith(row.describe, target.describe) &&
        row.describe.length === target.describe.length
        ? 1000
        : -1;
    case 'suite':
      return isSuiteRow(row) &&
        row.suite === target.suite &&
        row.describe.length === target.describe.length &&
        startsWith(row.describe, target.describe)
        ? 1000
        : -1;
    case 'block':
      return startsWith(row.describe, target.describe) ? 1 + target.describe.length : -1;
    case 'file':
      return 0;
    case 'entry':
    case 'prop':
      return -1;
  }
}

function coveringRow(
  rows: IndexedRow[],
  file: string,
  row: TestRow,
  accepts: (kind: ExceptionRow['kind']) => boolean,
): IndexedRow | undefined {
  let best: IndexedRow | undefined;
  let bestRank = -1;
  for (const item of rows) {
    if (item.row.upstream !== file || !accepts(item.row.kind)) {
      continue;
    }
    const rank = coverRank(item.target, row);
    if (rank > bestRank) {
      best = item;
      bestRank = rank;
    }
  }
  return best;
}

function addedConditions(upstreamRow: TestRow, vaseRow: TestRow): string[] {
  const upstream = new Set(upstreamRow.conditions?.flatMap(conditionTerms));
  return (vaseRow.conditions ?? []).flatMap(conditionTerms).filter((term) => !upstream.has(term));
}

type UpstreamSuite = FamilyExtract['cases'][number];

interface SuiteMatch {
  suite: UpstreamSuite;
  paths: string[];
  rows: ({ path: string; row: TestRow } | undefined)[];
  unpaired: number;
  titleProblems: string[];
  ambiguous?: string[];
}

interface RowPool {
  path: string;
  rows: TestRow[];
  claims: RowClaim[];
  extraOwner: SuiteMatch;
}

interface RowClaim {
  owner: SuiteMatch;
  index: number;
  order: number;
  choices: RowPool[];
}

function reserveRow(claim: RowClaim, visited: Set<RowPool>): boolean {
  for (const pool of claim.choices) {
    if (pool.claims.length < pool.rows.length) {
      pool.claims.push(claim);
      return true;
    }
  }
  // A split helper can use another file when this suite needs its last occurrence.
  for (const pool of claim.choices) {
    if (visited.has(pool)) {
      continue;
    }
    visited.add(pool);
    const index = pool.claims.findLastIndex(
      (prior) => prior.choices.length > 1 && reserveRow(prior, visited),
    );
    if (index >= 0) {
      pool.claims[index] = claim;
      return true;
    }
  }
  return false;
}

function describePaths(titles: string[]): string[] {
  return titles.map((_, i) => JSON.stringify(titles.slice(0, titles.length - i)));
}

export function matchCases(
  suites: UpstreamSuite[],
  vase: VaseTree,
): Map<UpstreamSuite, SuiteMatch> {
  const matches = new Map<UpstreamSuite, SuiteMatch>();
  const destinations = new Map<string, SuiteMatch[]>();
  for (const suite of suites) {
    const paths = counterparts(suite.file, vase.files).filter((path) => !path.endsWith('.vue'));
    const match: SuiteMatch = { suite, paths, rows: [], unpaired: 0, titleProblems: [] };
    matches.set(suite, match);
    if (paths.length > 1 && !vase.files.relocations?.has(suite.file)) {
      match.ambiguous = paths;
      continue;
    }
    for (const path of paths) {
      destinations.set(path, [...(destinations.get(path) ?? []), match]);
    }
  }

  const pools = new Map<string, Map<string, RowPool>>();
  for (const [path, owners] of destinations) {
    const rows = vase.rowsOf(path);
    const upstream = owners.flatMap(({ suite }) => suite.rows);
    owners[0].titleProblems.push(...checkTitleNames(path, rows, upstream));
    const blocks = new Map<string, SuiteMatch>();
    if (owners.length > 1) {
      for (const owner of owners) {
        for (const row of owner.suite.rows) {
          for (const block of describePaths(
            row.describe.map((title) => toVaseName(title, 'title')),
          )) {
            if (!blocks.has(block)) {
              blocks.set(block, owner);
            }
          }
        }
      }
    }
    const byKey = new Map<string, RowPool>();
    for (const [key, occurrences] of Map.groupBy(rows, (row) => keyOf(row, 'vase'))) {
      const extraOwner =
        describePaths(occurrences[0].describe)
          .map((block) => blocks.get(block))
          .find(Boolean) ?? owners[0];
      byKey.set(key, { path, rows: occurrences, claims: [], extraOwner });
    }
    pools.set(path, byKey);
  }

  let order = 0;
  for (const owner of matches.values()) {
    if (owner.ambiguous) {
      continue;
    }
    for (const [index, row] of owner.suite.rows.entries()) {
      const key = keyOf(row, 'upstream');
      const choices = owner.paths.flatMap((path) => pools.get(path)?.get(key) ?? []);
      reserveRow({ owner, index, order: order++, choices }, new Set());
    }
  }
  for (const byKey of pools.values()) {
    for (const pool of byKey.values()) {
      pool.claims
        .sort((a, b) => a.order - b.order)
        .forEach(({ owner, index }, i) => {
          owner.rows[index] = { path: pool.path, row: pool.rows[i] };
        });
      pool.extraOwner.unpaired += pool.rows.length - pool.claims.length;
    }
  }
  return matches;
}

function targetExists(target: Target, extract: FamilyExtract): boolean {
  const rows = extract.cases.find(({ file }) => file === target.upstream)?.rows;
  switch (target.type) {
    case 'file':
      return (
        extract.sources.includes(target.upstream) ||
        extract.typeTests.includes(target.upstream) ||
        rows !== undefined
      );
    case 'block':
      return rows?.some((row) => startsWith(row.describe, target.describe)) === true;
    case 'case':
    case 'suite':
      return rows?.some((row) => coverRank(target, row) === 1000) === true;
    case 'entry':
    case 'prop':
      return true;
  }
}

export function checkFamily(
  name: string,
  family: FamilyFile,
  extract: FamilyExtract,
  vase: VaseTree,
  matches = matchCases(extract.cases, vase),
): FamilyResult {
  const problems: string[] = [];
  const problem = (message: string): void => {
    problems.push(`${name}: ${message}`);
  };
  const rows: IndexedRow[] = family.exceptions.flatMap((row, index) => {
    const target = targetOf(row);
    return target && target.type !== 'entry' && target.type !== 'prop'
      ? [{ row, index, target }]
      : [];
  });
  const used = new Set<number>();
  const reported = new Set<number>();
  const where = (item: IndexedRow): string => `exceptions[${item.index}] (${labelOf(item.target)})`;
  const noCounterpart = (path: string): boolean => !hasCounterpart(path, vase.files);

  const summary: FamilySummary = {
    name,
    sources: fileTally(extract.sources.length),
    typeTests: fileTally(extract.typeTests.length),
    cases: rowTally(0),
    suiteCalls: rowTally(0),
    rowsWithoutUpstream: 0,
  };

  for (const item of rows) {
    if (!targetExists(item.target, extract)) {
      reported.add(item.index);
      problem(
        `stale row ${where(item)}: the extract has nothing that the row names. Remove the row, or run \`${extractCommand(name)}\` if the family paths changed.`,
      );
    }
  }

  const checkFileList = (
    paths: string[],
    tally: FileTally,
    noun: string,
    isTarget: (item: IndexedRow) => boolean,
  ): void => {
    for (const path of paths) {
      const own = rows.filter((item) => item.row.upstream === path && isTarget(item));
      if (noCounterpart(path)) {
        const first = own[0];
        if (!first) {
          problem(
            `uncovered ${noun} ${path}: Vase UI has no counterpart. Port the file, or add an exception row.`,
          );
        } else {
          used.add(first.index);
          tally[first.row.kind as CoveredKind] += 1;
        }
      } else {
        tally.ported += 1;
        for (const item of own) {
          used.add(item.index);
          reported.add(item.index);
          problem(
            `stale row ${where(item)}: Vase UI has the counterpart ${counterparts(path, vase.files).join(', ')}. Remove the row.`,
          );
        }
      }
    }
  };
  checkFileList(
    extract.sources,
    summary.sources,
    'source file',
    (item) => item.target.type === 'file' && isSourceFileTarget(item.target),
  );
  checkFileList(
    extract.typeTests,
    summary.typeTests,
    'type test',
    (item) => item.target.type === 'file' && isTypeTestFile(item.row.upstream),
  );

  for (const suite of extract.cases) {
    const { file, rows: upstreamRows } = suite;
    const match = matches.get(suite) as SuiteMatch;
    for (const row of upstreamRows) {
      (isSuiteRow(row) ? summary.suiteCalls : summary.cases).total += 1;
    }
    if (match.ambiguous) {
      problem(`${file}: ${match.ambiguous.join(' and ')} both match. Delete one of them.`);
      continue;
    }
    problems.push(...match.titleProblems);
    summary.rowsWithoutUpstream += match.unpaired;
    for (const [index, upstreamRow] of upstreamRows.entries()) {
      const tally = isSuiteRow(upstreamRow) ? summary.suiteCalls : summary.cases;
      const port = match.rows[index];
      if (!port) {
        const cover = coveringRow(rows, file, upstreamRow, (kind) => kind !== 'engine');
        if (!cover) {
          problem(
            `uncovered ${describesRow(upstreamRow)} in ${file}: Vase UI has no row for it. Port it, or add an exception row.`,
          );
        } else {
          used.add(cover.index);
          tally[cover.row.kind as CoveredKind] += 1;
        }
        continue;
      }
      tally.matched += 1;
      const added = addedConditions(upstreamRow, port.row);
      if (added.length > 0) {
        const cover = coveringRow(rows, file, upstreamRow, (kind) => kind === 'engine');
        if (!cover) {
          problem(
            `added condition on ${describesRow(port.row)} in ${port.path}: Base UI does not have ${added.join(', ')}. Remove each added condition, or add an "engine" row.`,
          );
        } else {
          used.add(cover.index);
          tally.engine[cover.row.engine as Engine] += 1;
        }
      }
    }
  }

  for (const item of rows) {
    const { row, target } = item;
    if (reported.has(item.index)) {
      continue;
    }
    const isSourceRow = isSourceFileTarget(target);
    if (row.kind === 'engine') {
      if (!used.has(item.index)) {
        problem(
          `stale row ${where(item)}: it covers no matched row with an added condition. Remove the row.`,
        );
      }
      continue;
    }
    if (!isSourceRow && !used.has(item.index)) {
      problem(`stale row ${where(item)}: it covers no row without a match. Remove the row.`);
    }
    if (row.kind === 'waits-on' && row.waitsOn !== undefined && !noCounterpart(row.waitsOn)) {
      problem(
        `stale row ${where(item)}: Vase UI has the counterpart of ${row.waitsOn}. Port the tests, then remove the row.`,
      );
    }
    if (row.kind === 'replaced') {
      const test = row.test as string;
      if (!vase.files.paths.has(test) || !(isTestFile(test) || isTypeTestFile(test))) {
        problem(
          `row ${where(item)}: the "test" file ${test} is not a test file under packages/vue/src or packages/vue/test. Correct the path.`,
        );
      }
    }
  }

  return { problems, summary };
}
