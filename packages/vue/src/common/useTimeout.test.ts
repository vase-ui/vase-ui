import { effectScope } from 'vue';
import { expect, vi, describe, afterEach, it } from 'vitest';
import { useTimeout } from './useTimeout';

describe('useTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears a pending timeout when its effect scope stops', () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const timeout = scope.run(() => useTimeout())!;
    const fn = vi.fn();

    timeout.start(10, fn);
    expect(timeout.isStarted()).toBe(true);

    scope.stop();
    vi.advanceTimersByTime(20);

    expect(fn).not.toHaveBeenCalled();
    expect(timeout.isStarted()).toBe(false);
  });
});
