import type {
  BehaviorCaseResult,
  BehaviorVerdict,
} from '../../../scripts/docs/benchmarksReport.ts';

const VERDICTS: Record<BehaviorVerdict, string> = {
  pass: 'Pass',
  fail: 'Fail',
  partly: 'Partly',
  'not-stable': 'Not stable',
  'not-measured': 'Not measured: frame gaps',
};

/** The verdict of a cell. */
export function behaviorVerdictName(verdict: BehaviorVerdict): string {
  return VERDICTS[verdict];
}

/** A list of names, such as `Chromium, Firefox and WebKit`. */
export function listOf(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
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
