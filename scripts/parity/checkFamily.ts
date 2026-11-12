import { isSuiteRow } from './cases.ts';
import type { TestRow } from './cases.ts';
import { isSourceFileTarget, labelOf, targetOf } from './parityFiles.ts';
import type { Engine, FamilyExtract, ExceptionRow, FamilyFile, Target } from './parityFiles.ts';
import { counterparts, hasCounterpart, isTestFile, isTypeTestFile } from './paths.ts';
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

const keyOf = (row: TestRow): string =>
  JSON.stringify(
    isSuiteRow(row) ? [row.describe, 'suite', row.suite] : [row.describe, 'title', row.title],
  );

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
    default:
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

function pairRows(upstreamRows: TestRow[], vaseRows: TestRow[]) {
  const pool = new Map<string, TestRow[]>();
  for (const row of vaseRows) {
    const key = keyOf(row);
    pool.set(key, [...(pool.get(key) ?? []), row]);
  }
  const pairs: [TestRow, TestRow][] = [];
  const unmatched: TestRow[] = [];
  for (const row of upstreamRows) {
    const found = pool.get(keyOf(row))?.shift();
    if (found) {
      pairs.push([row, found]);
    } else {
      unmatched.push(row);
    }
  }
  const unpaired = [...pool.values()].reduce((total, rows) => total + rows.length, 0);
  return { pairs, unmatched, unpaired };
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
    default:
      return true;
  }
}

export function checkFamily(
  name: string,
  family: FamilyFile,
  extract: FamilyExtract,
  vase: VaseTree,
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

  for (const { file, rows: upstreamRows } of extract.cases) {
    for (const row of upstreamRows) {
      (isSuiteRow(row) ? summary.suiteCalls : summary.cases).total += 1;
    }
    const candidates = counterparts(file, vase.files).filter((path) => !path.endsWith('.vue'));
    if (candidates.length > 1) {
      problem(`${file}: ${candidates.join(' and ')} both match. Delete one of them.`);
      continue;
    }
    const vaseRows = candidates.length === 1 ? vase.rowsOf(candidates[0]) : [];
    const { pairs, unmatched, unpaired } = pairRows(upstreamRows, vaseRows);
    summary.rowsWithoutUpstream += unpaired;
    for (const [upstreamRow, vaseRow] of pairs) {
      const tally = isSuiteRow(upstreamRow) ? summary.suiteCalls : summary.cases;
      tally.matched += 1;
      if (vaseRow.conditions?.length && !upstreamRow.conditions?.length) {
        const cover = coveringRow(rows, file, upstreamRow, (kind) => kind === 'engine');
        if (!cover) {
          problem(
            `added condition on ${describesRow(vaseRow)} in ${candidates[0]}: Base UI has no condition on it. Remove the condition, or add an "engine" row.`,
          );
        } else {
          used.add(cover.index);
          tally.engine[cover.row.engine as Engine] += 1;
        }
      }
    }
    for (const row of unmatched) {
      const tally = isSuiteRow(row) ? summary.suiteCalls : summary.cases;
      const cover = coveringRow(rows, file, row, (kind) => kind !== 'engine');
      if (!cover) {
        problem(
          `uncovered ${describesRow(row)} in ${file}: Vase UI has no row for it. Port it, or add an exception row.`,
        );
      } else {
        used.add(cover.index);
        tally[cover.row.kind as CoveredKind] += 1;
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
