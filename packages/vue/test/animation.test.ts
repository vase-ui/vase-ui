import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, nextAnimationsRead, nextEvent } from '#test-utils';

interface LimitRow {
  name: string;
  frames: number;
  message: string;
  wait: (action: () => Promise<void>) => Promise<unknown>;
}

describe('the limits of the motion helpers', () => {
  // Only the frames are fake, and a case runs each frame itself. A limit that counts time does not
  // end in these cases.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A helper starts its count in a microtask after the end of its action.
  async function runFrames(count: number) {
    await flushMicrotasks();
    for (let frame = 0; frame < count; frame += 1) {
      vi.advanceTimersToNextFrame();
    }
    await flushMicrotasks();
  }

  it.each<LimitRow>([
    {
      name: 'nextEvent',
      frames: 180,
      message: 'No transitionend event came in 180 frames of the page.',
      wait: (action) => nextEvent(new EventTarget(), 'transitionend', { action }),
    },
    {
      name: 'nextAnimationsRead',
      frames: 600,
      message: 'No part read the animations of the element in 600 frames of the page.',
      wait: (action) => nextAnimationsRead(document.createElement('div'), { action }),
    },
  ])(
    '$name rejects in frame $frames after the end of its action',
    async ({ frames, message, wait }) => {
      let endAction = () => {};
      let rejection: string | undefined;
      wait(
        () =>
          new Promise<void>((resolve) => {
            endAction = resolve;
          }),
      ).catch((error: unknown) => {
        rejection = (error as Error).message;
      });

      await runFrames(frames);
      expect(rejection).toBeUndefined();

      endAction();
      await runFrames(frames - 1);
      expect(rejection).toBeUndefined();

      await runFrames(1);
      expect(rejection).toBe(message);
    },
  );
});
