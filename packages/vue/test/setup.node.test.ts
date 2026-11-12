import { describe, expect, it } from 'vitest';

describe('test setup in Node', () => {
  it('leaves the global CSS undefined, as on a server', () => {
    expect(typeof CSS).toBe('undefined');
  });
});
