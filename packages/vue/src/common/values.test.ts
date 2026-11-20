import { expect, test } from 'vitest';
import { sameValue } from './values';

test.each([
  { a: ['fuji', 'gala'], b: ['gala', 'fuji'], same: true },
  { a: [20, 30], b: [20, 20], same: false },
  { a: [20, 20, 30], b: [20, 30, 30], same: false },
  { a: [Number.NaN], b: [Number.NaN], same: true },
  { a: [1], b: [1, 1], same: false },
  { a: null, b: '', same: true },
  { a: 0, b: '', same: false },
])('sameValue($a, $b) is $same', ({ a, b, same }) => {
  expect(sameValue(a, b)).toBe(same);
});
