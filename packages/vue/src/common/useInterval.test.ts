import { effectScope } from 'vue';
import { expect, vi, describe, afterEach, it } from 'vitest';
import { useInterval } from './useInterval';

describe('useInterval', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at each interval until its effect scope stops', () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const interval = scope.run(() => useInterval())!;
    const fn = vi.fn();

    interval.start(10, fn);
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(2);

    scope.stop();
    vi.advanceTimersByTime(20);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
