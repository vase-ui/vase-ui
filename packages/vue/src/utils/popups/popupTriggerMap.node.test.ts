import { afterEach, describe, expect, it, vi } from 'vitest';
import { PopupTriggerMap } from './popupTriggerMap';

describe('PopupTriggerMap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw in production when the same element is registered under multiple ids', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(process.env.NODE_ENV).toBe('production');

    const map = new PopupTriggerMap();
    const button = {} as Element;

    map.add('first', button);
    expect(() => map.add('second', button)).not.toThrow();
    expect(map.getById('first')).toBe(button);
    expect(map.getById('second')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.size).toBe(2);
  });
});
