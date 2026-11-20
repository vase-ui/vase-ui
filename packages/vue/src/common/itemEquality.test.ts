import { expect, describe, it, vi } from 'vitest';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  selectedValueIncludes,
} from './itemEquality';

describe('itemEquality', () => {
  it('never matches an `undefined` item or an `undefined` selected value', () => {
    expect(findItemIndex([undefined, 'b'], undefined, defaultItemEquality)).toBe(-1);
    expect(findItemIndex([undefined, 'b'], 'b', defaultItemEquality)).toBe(1);
    expect(selectedValueIncludes([undefined, 'b'], undefined, defaultItemEquality)).toBe(false);
    expect(selectedValueIncludes([undefined, 'b'], 'b', defaultItemEquality)).toBe(true);
  });

  it('compares `null` and `undefined` by identity and does not call the comparer for them', () => {
    const comparer = vi.fn(() => true);

    expect(compareItemEquality(null, 'a', comparer)).toBe(false);
    expect(compareItemEquality('a', undefined, comparer)).toBe(false);
    expect(compareItemEquality(null, null, comparer)).toBe(true);
    expect(comparer).not.toHaveBeenCalled();
  });
});
