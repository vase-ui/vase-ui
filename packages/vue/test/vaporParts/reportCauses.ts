import { appendFileSync } from 'node:fs';
import type { Reporter, TestCase, TestModule, TestResult } from 'vitest/node';
import expectations from './expectedFailures.json' with { type: 'json' };

export function actualPass(result: TestResult, expectsFailure: boolean): boolean | undefined {
  if (result.state === 'pending' || result.state === 'skipped') return undefined;
  if (!expectsFailure) return result.state === 'passed';
  // Vitest adds this error when a case with an expected failure passes all its hooks.
  return (
    result.state === 'failed' &&
    result.errors.length > 0 &&
    result.errors.every((error) => error.message === 'Expect test to fail')
  );
}

export function* resultsForFile(
  fails: Record<string, string>,
  tests: Iterable<Pick<TestCase, 'meta' | 'result'>>,
) {
  const missing = new Map(Object.entries(fails));
  for (const test of tests) {
    const expectation = test.meta().vaporExpectation;
    if (!expectation) continue;
    missing.delete(expectation.name);
    yield [fails[expectation.name], actualPass(test.result(), expectation.fails)] as const;
  }
  for (const cause of missing.values()) yield [cause, undefined] as const;
}

export default class CauseReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
    const counts = new Map(
      Object.keys(expectations.causes).map((cause) => [cause, { passed: 0, failed: 0, absent: 0 }]),
    );
    const tests = new Map(modules.map((file) => [file.relativeModuleId, file.children.allTests()]));
    for (const [file, { fails }] of Object.entries(expectations.files)) {
      for (const [cause, passed] of resultsForFile(fails, tests.get(file) ?? [])) {
        const count = counts.get(cause);
        if (!count) continue;
        if (passed === undefined) count.absent++;
        else if (passed) count.passed++;
        else count.failed++;
      }
    }
    const table = [
      '| Vue cause | Passed | Failed | Did not run |',
      '| --- | ---: | ---: | ---: |',
      ...Array.from(
        counts,
        ([cause, { passed, failed, absent }]) => `| ${cause} | ${passed} | ${failed} | ${absent} |`,
      ),
    ].join('\n');
    console.log(table);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n');
    }
  }
}
