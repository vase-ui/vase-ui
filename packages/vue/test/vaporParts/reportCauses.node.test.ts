import { expect, it } from 'vitest';
import type { TestResult } from 'vitest/node';
import { actualPass } from './reportCauses';

it('reports the final result of a case before Vitest reverses an expected failure', () => {
  const pass: TestResult = { state: 'passed', errors: undefined };
  const failure: TestResult = { state: 'failed', errors: [{ message: 'A hook failed' }] };
  const unexpectedPass: TestResult = {
    state: 'failed',
    errors: [{ message: 'Expect test to fail' }],
  };
  expect(actualPass(pass, false)).toBe(true);
  expect(actualPass(failure, false)).toBe(false);
  expect(actualPass(pass, true)).toBe(false);
  expect(actualPass(unexpectedPass, true)).toBe(true);
  expect(actualPass(failure, true)).toBe(false);
  expect(
    actualPass({ state: 'skipped', errors: undefined, note: undefined }, true),
  ).toBeUndefined();
  expect(actualPass({ state: 'pending', errors: undefined }, false)).toBeUndefined();
});
