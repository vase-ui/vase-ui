import { expect, it } from 'vitest';
import type { TestResult } from 'vitest/node';
import { actualPass, resultsForFile } from './reportCauses';

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
    actualPass({ state: 'failed', errors: [...unexpectedPass.errors, ...failure.errors] }, true),
  ).toBe(false);
  expect(
    actualPass({ state: 'skipped', errors: undefined, note: undefined }, true),
  ).toBeUndefined();
  expect(actualPass({ state: 'pending', errors: undefined }, false)).toBeUndefined();
});

it('counts each case with a listed title and keeps an absent title in the report', () => {
  const pass = { state: 'passed', errors: undefined } as const;
  const skipped = { state: 'skipped', errors: undefined, note: undefined } as const;
  const meta = () => ({ vaporExpectation: { name: 'shared title', fails: false } });
  const tests = [
    { meta, result: () => pass },
    { meta, result: () => pass },
    { meta, result: () => skipped },
    { meta: () => ({}), result: () => pass },
  ];
  expect([...resultsForFile({ 'shared title': 'one', missing: 'two' }, tests)]).toEqual([
    ['one', true],
    ['one', true],
    ['one', undefined],
    ['two', undefined],
  ]);
});
