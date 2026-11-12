import { effectScope } from 'vue';
import { expect, vi, describe, beforeEach, afterEach, it } from 'vitest';
import {
  AnimationFrame,
  resetAnimationFrameScheduler,
  useAnimationFrame,
} from './useAnimationFrame';

describe('AnimationFrame', () => {
  beforeEach(() => {
    resetAnimationFrameScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAnimationFrameScheduler();
  });

  it('keeps callback accounting correct when a frame is canceled more than once', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    const firstId = AnimationFrame.request(() => {});
    AnimationFrame.cancel(firstId);
    AnimationFrame.cancel(firstId);

    const secondCallback = vi.fn();
    AnimationFrame.request(secondCallback);

    callbacks[0]?.(0);

    expect(secondCallback).toHaveBeenCalledTimes(1);
  });
});

describe('useAnimationFrame', () => {
  beforeEach(() => {
    resetAnimationFrameScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAnimationFrameScheduler();
  });

  it('cancels a pending frame when its effect scope stops', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    const scope = effectScope();
    const frame = scope.run(() => useAnimationFrame())!;
    const fn = vi.fn();

    frame.request(fn);
    expect(callbacks).toHaveLength(1);

    scope.stop();
    callbacks[0]?.(0);

    expect(fn).not.toHaveBeenCalled();
  });
});
