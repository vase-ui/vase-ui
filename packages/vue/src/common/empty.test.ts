import { expect, describe, it } from 'vitest';
import { EMPTY_ARRAY } from './empty';

describe('empty', () => {
  it('keeps the shared EMPTY_ARRAY frozen', () => {
    expect(Object.isFrozen(EMPTY_ARRAY)).toBe(true);
    expect(EMPTY_ARRAY).toHaveLength(0);
  });
});
