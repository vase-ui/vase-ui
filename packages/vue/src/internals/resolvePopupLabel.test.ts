import { describe, expect, it } from 'vitest';
import { resolvePopupLabel } from './resolvePopupLabel';

describe('resolvePopupLabel', () => {
  it('falls back to the trigger id', () => {
    expect(resolvePopupLabel({}, null, 'trigger')).toBe('trigger');
  });
});
