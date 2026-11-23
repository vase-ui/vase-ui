import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failLines, listOf } from '../../docs/.vitepress/components/benchmarksBehaviorText.ts';
import type { BehaviorCaseResult } from './benchmarksReport.ts';

function result(
  name: string | null,
  verdict: BehaviorCaseResult['verdict'],
  reason?: string,
): BehaviorCaseResult {
  return {
    case: name,
    verdict,
    passes: verdict === 'pass' ? 3 : verdict === 'not-stable' ? 2 : 0,
    valid: 3,
    measure: '',
    ...(reason === undefined ? {} : { reason }),
  };
}

test('a list of names joins the last name with "and"', () => {
  assert.equal(listOf([]), '');
  assert.equal(listOf(['Chromium']), 'Chromium');
  assert.equal(listOf(['Chromium', 'Firefox', 'WebKit']), 'Chromium, Firefox and WebKit');
});

test('a cell with cases of more than one verdict names the cases that do not pass, by verdict', () => {
  assert.deepEqual(
    failLines([
      result('Dialog', 'pass'),
      result('Menu', 'fail', 'A jump.'),
      result('Select', 'fail', 'A jump.'),
      result('Tooltip', 'not-stable', 'No flip.'),
      result('Popover', 'not-measured'),
    ]),
    [
      'Fail: Menu and Select',
      'Not stable: Tooltip',
      'Not measured: Popover',
      'Menu and Select: A jump.',
      'Tooltip: 2 of 3 runs pass. No flip.',
    ],
  );
  assert.deepEqual(failLines([result('Dialog', 'pass'), result('Menu', 'fail', 'A jump.')]), [
    'Fail: Menu',
    'Menu: A jump.',
  ]);
});

test('a cell where each case fails gives only the reasons', () => {
  assert.deepEqual(failLines([result(null, 'fail', 'The focus is lost.')]), ['The focus is lost.']);
  assert.deepEqual(
    failLines([result('mouse', 'fail', 'No swipe.'), result('touch', 'fail', 'No swipe.')]),
    ['mouse and touch: No swipe.'],
  );
  assert.deepEqual(failLines([result('mouse', 'pass')]), []);
});
