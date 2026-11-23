import type {
  BehaviorCaseResult,
  BehaviorEngineResult,
  BehaviorVerdict,
  SizeCell,
} from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';

const BYTES = new Intl.NumberFormat('en-US');

export function formatBytes(bytes: number): string {
  return BYTES.format(bytes);
}

export function sizeCellText(cell: SizeCell | undefined, unit: 'raw' | 'gzip' | 'brotli'): string {
  if (cell === undefined || cell === 'not-measured') {
    return 'Not measured yet';
  }
  if (cell === 'not-provided') {
    return 'Not provided';
  }
  return formatBytes(cell[unit]);
}

const RATIO = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Milliseconds with 3 significant digits, and no fraction from 1,000 up. */
export function formatMilliseconds(milliseconds: number): string {
  const digits = milliseconds < 1 ? 3 : milliseconds < 10 ? 2 : milliseconds < 100 ? 1 : 0;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(milliseconds)} ms`;
}

/** A median or a p90 of the heap can fall between two samples, so the bytes are rounded. */
export function formatMeasure(value: number, unit: 'ms' | 'bytes'): string {
  return unit === 'ms' ? formatMilliseconds(value) : `${formatBytes(Math.round(value))} bytes`;
}

export function formatRatio(ratio: number): string {
  return `${RATIO.format(ratio)}×`;
}

export function formatInterval([low, high]: readonly [number, number]): string {
  return `${RATIO.format(low)} to ${RATIO.format(high)}`;
}

const ENGINE_NAMES: Record<string, string> = {
  chromium: 'Chromium',
  firefox: 'Firefox',
  webkit: 'WebKit',
};

export function engineName(engine: string): string {
  return ENGINE_NAMES[engine] ?? engine;
}

export function libraryName(id: string): string {
  return data.libraries.find((library) => library.id === id)?.name ?? id;
}

/** The head of the column of a library in a table: Base UI is the reference from React. */
export function columnName(id: string): string {
  return id === 'base-ui' ? `${libraryName(id)} (React reference)` : libraryName(id);
}

export function setupName(setup: string): string {
  return data.setups.find((item) => item.id === setup)?.name ?? setup;
}

/** The setup with its version of Vue, such as `Vapor app, Vue 3.6.0-rc.16`. */
export function setupHeading(setup: string): string {
  const found = data.setups.find((item) => item.id === setup);
  return found === undefined ? setup : `${found.name}, Vue ${found.version}`;
}

const BEHAVIOR_VERDICTS: Record<BehaviorVerdict, string> = {
  pass: 'Pass',
  fail: 'Fail',
  partly: 'Partly',
  'not-stable': 'Not stable',
  'not-measured': 'Not measured: frame gaps',
};

export function behaviorVerdictName(verdict: BehaviorVerdict): string {
  return BEHAVIOR_VERDICTS[verdict];
}

/** A list of names, such as `Chromium, Firefox and WebKit`. */
export function listOf(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** The engines that give the same result, by a key of the result, in the sequence of the engines. */
export function sameResults(
  engines: readonly BehaviorEngineResult[],
  key: (engine: BehaviorEngineResult) => string,
): { names: string; result: BehaviorEngineResult }[] {
  const groups = new Map<string, BehaviorEngineResult[]>();
  for (const engine of engines) {
    groups.set(key(engine), [...(groups.get(key(engine)) ?? []), engine]);
  }
  return [...groups.values()].map((same) => ({
    names: listOf(same.map((engine) => engineName(engine.engine))),
    result: same[0],
  }));
}

/** The verdict and the cases that do not pass: the cell text is the same when this key is. */
export function verdictKey(engine: BehaviorEngineResult): string {
  return [
    engine.verdict,
    ...engine.cases
      .filter((item) => item.verdict !== 'pass')
      .map((item) => `${String(item.case)} ${item.verdict}`),
  ].join('\n');
}

const CASE_VERDICTS: Record<BehaviorCaseResult['verdict'], string> = {
  pass: 'Pass',
  fail: 'Fail',
  'not-stable': 'Not stable',
  'not-measured': 'Not measured',
};

/**
 * The lines below the verdict of a cell. When the cases do not all have one verdict, the first lines
 * name the cases that do not pass, by verdict, such as `Fail: Menu and Select`. Then each reason
 * follows, with the cases that give it.
 */
export function failLines(cases: readonly BehaviorCaseResult[]): string[] {
  const failing = cases.filter((item) => item.verdict !== 'pass');
  const verdicts = [...new Set(failing.map((item) => item.verdict))];
  const named = failing.filter((item) => item.case !== null);
  const reasons = new Map<string, string[]>();
  for (const item of failing) {
    const runs =
      item.verdict === 'not-stable'
        ? `${String(item.passes)} of ${String(item.valid)} runs pass. `
        : '';
    const text = `${runs}${item.reason ?? ''}`.trim();
    if (text !== '') {
      reasons.set(text, [...(reasons.get(text) ?? []), ...(item.case === null ? [] : [item.case])]);
    }
  }
  return [
    ...(failing.length < cases.length || verdicts.length > 1
      ? verdicts.map(
          (verdict) =>
            `${CASE_VERDICTS[verdict]}: ${listOf(named.filter((item) => item.verdict === verdict).map((item) => item.case ?? ''))}`,
        )
      : []),
    ...[...reasons].map(([text, names]) =>
      names.length === 0 ? text : `${listOf(names)}: ${text}`,
    ),
  ];
}
