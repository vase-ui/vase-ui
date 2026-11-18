import { appendFileSync } from 'node:fs';
import type { Reporter, TestModule, TestResult } from 'vitest/node';
import expectations from './expectedFailures.json' with { type: 'json' };

export function actualPass(result: TestResult, expectsFailure: boolean): boolean | undefined {
  if (result.state === 'pending' || result.state === 'skipped') return undefined;
  if (!expectsFailure) return result.state === 'passed';
  // Vitest adds this error when a case with an expected failure passes all its hooks.
  return (
    result.state === 'failed' &&
    result.errors.some((error) => error.message === 'Expect test to fail')
  );
}

export default class CauseReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
    const counts = new Map(
      Object.keys(expectations.causes).map((cause) => [cause, { passed: 0, ran: 0, listed: 0 }]),
    );
    for (const { fails } of Object.values(expectations.files)) {
      for (const cause of Object.values(fails)) {
        const count = counts.get(cause);
        if (count) count.listed++;
      }
    }
    for (const file of modules) {
      for (const test of file.children.allTests()) {
        const expectation = test.meta().vaporExpectation;
        if (!expectation) continue;
        const count = counts.get(expectation.cause);
        const passed = actualPass(test.result(), expectation.fails);
        if (!count || passed === undefined) continue;
        count.ran++;
        if (passed) count.passed++;
      }
    }
    const table = [
      '| Vue cause | Passed | Failed | Did not run |',
      '| --- | ---: | ---: | ---: |',
      ...Array.from(
        counts,
        ([cause, { passed, ran, listed }]) =>
          `| ${cause} | ${passed} | ${ran - passed} | ${listed - ran} |`,
      ),
    ].join('\n');
    console.log(table);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n');
    }
  }
}
