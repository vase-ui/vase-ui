import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  flushMicrotasks,
  nextAnimationsRead,
  nextEndingStyle,
  nextEvent,
  probeFrameAfterExitBeforeRead,
  waitSingleFrame,
} from '#test-utils';

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
    {
      name: 'nextEndingStyle',
      frames: 180,
      message: 'The element got no data-ending-style in 180 frames of the page.',
      wait: (action) => nextEndingStyle(document.createElement('div'), { action }),
    },
    {
      name: 'probeFrameAfterExitBeforeRead',
      frames: 180,
      message: 'The element got no data-ending-style in 180 frames of the page.',
      wait: (action) =>
        probeFrameAfterExitBeforeRead(document.createElement('div'), () => false, action),
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

describe('nextEndingStyle', () => {
  // A wait that an old ending style resolves cannot show that an exit started.
  it('resolves only when the element gets the ending style after the call', async () => {
    const element = document.createElement('div');
    element.setAttribute('data-ending-style', '');
    let isResolved = false;
    const wait = nextEndingStyle(element).then(() => {
      isResolved = true;
    });

    element.setAttribute('data-closed', '');
    await waitSingleFrame();
    expect(isResolved).toBe(false);

    element.removeAttribute('data-ending-style');
    await waitSingleFrame();
    expect(isResolved).toBe(false);

    element.setAttribute('data-ending-style', '');
    await wait;
  });
});

describe('probeFrameAfterExitBeforeRead', () => {
  interface RemovalRow {
    name: string;
    remove: (element: HTMLElement) => void;
    isGone: boolean;
  }

  function appendElementWithExit() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes probe-exit { from { opacity: 1; } to { opacity: 0; } }
      .probe-element[data-ending-style] { animation: probe-exit 100s linear; }
    `;
    const element = document.createElement('div');
    element.className = 'probe-element';
    document.body.append(style, element);
    onTestFinished(() => {
      style.remove();
      element.remove();
    });
    return element;
  }

  // A probe that cannot see a late removal proves nothing.
  it.each<RemovalRow>([
    { name: 'at the end', remove: (element) => element.remove(), isGone: true },
    {
      name: 'in a later task',
      remove: (element) => setTimeout(() => element.remove()),
      isGone: false,
    },
  ])('reports the removal of the element $name', async ({ remove, isGone }) => {
    const element = appendElementWithExit();
    element.addEventListener('animationend', () => remove(element));

    const result = await probeFrameAfterExitBeforeRead(
      element,
      () => !element.isConnected,
      () => element.setAttribute('data-ending-style', ''),
    );

    expect(result).toEqual({ isGone, isReadBeforeEnd: false, isSameFrame: true });
  });

  // A probe that cannot see a read before the end proves nothing. The browser runs the callbacks
  // of a frame in sequence, with a microtask checkpoint after each callback. The probe moves the
  // exit in the checkpoint after the first callback, so the second callback reads before the end.
  it('reports a read of the animations before the end of the exit', async () => {
    const element = appendElementWithExit();

    const result = await probeFrameAfterExitBeforeRead(
      element,
      () => !element.isConnected,
      () => {
        requestAnimationFrame(() => element.setAttribute('data-ending-style', ''));
        requestAnimationFrame(() => element.getAnimations());
      },
    );

    expect(result).toEqual({ isGone: false, isReadBeforeEnd: true, isSameFrame: true });
  });
});
