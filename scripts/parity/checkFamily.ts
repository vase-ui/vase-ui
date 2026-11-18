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

function caseExceptions(family: FamilyFile): IndexedRow[] {
  return family.exceptions.flatMap((row, index) => {
    const target = targetOf(row);
    return target && target.type !== 'entry' && target.type !== 'prop'
      ? [{ row, index, target }]
      : [];
  });
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
  exceptions: IndexedRow[];
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
  candidates: RowClaim[];
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
    for (let index = pool.claims.length - 1; index >= 0; index -= 1) {
      const prior = pool.claims[index];
      if (prior.choices.length > 1 && reserveRow(prior, visited)) {
        pool.claims[index] = claim;
        return true;
      }
    }
  }
  return false;
}

function coverForPort({ owner, index }: RowClaim, port?: TestRow): IndexedRow | true | undefined {
  const { file, rows } = owner.suite;
  const row = rows[index];
  if (port && addedConditions(row, port).length === 0) {
    return true;
  }
  return coveringRow(owner.exceptions, file, row, (kind) =>
    port ? kind === 'engine' : kind !== 'engine',
  );
}

function alignSharedRows(pools: RowPool[]): void {
  const first = pools[0].candidates[0];
  if (
    !first ||
    (pools.length === 1 && pools[0].candidates.every((claim) => claim.owner === first.owner))
  ) {
    return;
  }
  const claims = [...new Set(pools.flatMap((pool) => pool.candidates))].sort(
    (a, b) => a.order - b.order,
  );
  const byOwner = new Map<SuiteMatch, RowClaim[]>();
  for (const claim of claims) {
    const queue = byOwner.get(claim.owner);
    if (queue) {
      queue.push(claim);
    } else {
      byOwner.set(claim.owner, [claim]);
    }
  }
  const required: IndexedRow[] = [];
  for (const [owner, items] of byOwner) {
    const indices = new Set(items.map(({ index }) => index));
    for (const item of owner.exceptions) {
      if (item.row.upstream !== owner.suite.file) {
        continue;
      }
      const covered = owner.suite.rows.flatMap((row, i) =>
        coverRank(item.target, row) >= 0 ? [i] : [],
      );
      if (covered.length && covered.every((i) => indices.has(i))) {
        required.push(item);
      }
    }
  }

  const original = pools.map((pool) => pool.claims);
  const reserved = new Map<RowClaim, TestRow>();
  for (const pool of pools) {
    pool.claims.forEach((claim, i) => reserved.set(claim, pool.rows[i]));
  }
  const misses = claims.length - reserved.size;
  const covers = claims.map((claim) => coverForPort(claim, reserved.get(claim)));
  const problems =
    covers.filter((cover) => !cover).length +
    required.filter((row) => !covers.includes(row)).length;
  if (!problems) {
    return;
  }
  const optional = new Map(claims.map((claim) => [claim, coverForPort(claim)]));
  const usable = pools.reduce(
    (total, pool) =>
      total +
      pool.rows.filter((port) => pool.candidates.some((claim) => coverForPort(claim, port))).length,
    0,
  );
  const minimum =
    Math.max(0, misses - [...optional.values()].filter(Boolean).length) +
    Math.max(0, reserved.size - usable);
  if (minimum >= problems) {
    return;
  }

  // Separate upstream files have no common order. Keep the maximum number of matches and
  // each file's duplicate order when a guard or an exception distinguishes the occurrences.
  const queues = [...byOwner.values()].map((items) => ({ items, next: 0 }));
  const unused = new Set(required);
  const refused = new Set<string>();
  for (const pool of pools) {
    pool.claims = [];
  }
  function align(remaining: number, omissions: number, budget: number): boolean {
    if (remaining === 0) {
      return omissions === 0 && unused.size <= budget;
    }
    const state = [
      budget,
      ...queues.map((queue) => queue.next),
      ...pools.map((pool) => pool.claims.length),
      ...required.map((row) => unused.has(row)),
    ].join(',');
    if (refused.has(state)) {
      return false;
    }
    for (const queue of queues) {
      const claim = queue.items[queue.next];
      if (!claim) {
        continue;
      }
      for (const pool of [...claim.choices, undefined]) {
        const port = pool?.rows[pool.claims.length];
        if (pool ? !port : omissions === 0) {
          continue;
        }
        const cover = pool ? coverForPort(claim, port) : optional.get(claim);
        const cost = cover ? 0 : 1;
        if (cost > budget) {
          continue;
        }
        const used = cover && cover !== true && unused.delete(cover);
        queue.next += 1;
        pool?.claims.push(claim);
        if (align(remaining - 1, omissions - (pool ? 0 : 1), budget - cost)) {
          return true;
        }
        pool?.claims.pop();
        queue.next -= 1;
        if (used) {
          unused.add(cover);
        }
      }
    }
    refused.add(state);
    return false;
  }
  for (let budget = minimum; budget < problems; budget += 1) {
    if (align(claims.length, misses, budget)) {
      return;
    }
  }
  pools.forEach((pool, i) => {
    pool.claims = original[i];
  });
}

function describePaths(titles: string[]): string[] {
  return titles.map((_, i) => JSON.stringify(titles.slice(0, titles.length - i)));
}

export function matchCases(
  families: { family: FamilyFile; extract: FamilyExtract }[],
  vase: VaseTree,
): Map<UpstreamSuite, SuiteMatch> {
  const matches = new Map<UpstreamSuite, SuiteMatch>();
  const destinations = new Map<string, SuiteMatch[]>();
  for (const { family, extract } of families) {
    const exceptions = caseExceptions(family);
    for (const suite of extract.cases) {
      const paths = counterparts(suite.file, vase.files).filter((path) => !path.endsWith('.vue'));
      const match: SuiteMatch = {
        suite,
        exceptions,
        paths,
        rows: [],
        unpaired: 0,
        titleProblems: [],
      };
      matches.set(suite, match);
      if (paths.length > 1 && !vase.files.relocations?.has(suite.file)) {
        match.ambiguous = paths;
        continue;
      }
      for (const path of paths) {
        destinations.set(path, [...(destinations.get(path) ?? []), match]);
      }
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
    for (const row of rows) {
      const key = keyOf(row, 'vase');
      const pool = byKey.get(key);
      if (pool) {
        pool.rows.push(row);
        continue;
      }
      const extraOwner =
        describePaths(row.describe)
          .map((block) => blocks.get(block))
          .find(Boolean) ?? owners[0];
      byKey.set(key, { path, rows: [row], claims: [], candidates: [], extraOwner });
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
      const claim = { owner, index, order: order++, choices };
      for (const pool of choices) {
        pool.candidates.push(claim);
      }
      reserveRow(claim, new Set());
    }
  }
  const remaining = new Set([...pools.values()].flatMap((byKey) => [...byKey.values()]));
  for (const first of remaining) {
    const connected = new Set([first]);
    for (const pool of connected) {
      remaining.delete(pool);
      pool.claims.sort((a, b) => a.order - b.order);
      for (const claim of pool.candidates) {
        for (const choice of claim.choices) {
          connected.add(choice);
        }
      }
    }
    alignSharedRows([...connected]);
    for (const pool of connected) {
      pool.claims.forEach(({ owner, index }, i) => {
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
  matches = matchCases([{ family, extract }], vase),
): FamilyResult {
  const problems: string[] = [];
  const problem = (message: string): void => {
    problems.push(`${name}: ${message}`);
  };
  const rows = caseExceptions(family);
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
