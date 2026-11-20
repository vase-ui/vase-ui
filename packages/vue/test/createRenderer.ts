import { within } from './queries';
import type { BoundQueries } from './queries';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { cloneElement } from './cloneElement';
import { recordVueWarnings } from './reportedMessages';
import { createTestApp } from './testApp';

/**
 * A vnode, or a function that returns a vnode. A vnode that has a `ref` must be made in a render
 * function, so a test that sets a `ref` passes a function: `render(() => <Part ref={ref} />)`.
 */
export type Renderable = VNode | (() => VNode);

export type VaseUIRenderResult = BoundQueries & {
  container: HTMLElement;
  unmount: () => void;
  user: ReturnType<typeof userEvent.setup>;
  rerender: (element: Renderable) => Promise<void>;
  setProps: (props: Record<string, unknown>) => Promise<void>;
};

// The fake clock of Vitest runs a frame each 16 ms from the time when fake timers start.
const FAKE_FRAME_DURATION = 16;

/** A reading of the wall clock and of the monotonic clock at one time. */
interface ClockMark {
  wall: number;
  monotonic: number;
}

function markClock(): ClockMark {
  return { wall: Date.now(), monotonic: performance.now() };
}

/**
 * Waits until `Date.now()` is later than each stamp that Vue can give a listener that it attaches
 * after `mark`. Vue stamps a listener with `Date.now()` when it attaches it.
 * No wait covers a step back of the wall clock between the end of the wait and the next event. In
 * Firefox and WebKit, `performance.now()` gives whole milliseconds, so the wait can end too early
 * when the wall clock steps back after `mark`. No wait covers a late read of `Date.now()`, as
 * `isWallClockLaterThan` describes it, when Vue stamps a listener.
 */
async function waitPastStampsSince(mark: ClockMark) {
  // The system can set the wall clock back by some milliseconds. `Date.now()` is then smaller than
  // the stamp of a listener that Vue attached before the step. The monotonic clock has no steps,
  // so the second value is the latest stamp that the wall clock gives with no step back.
  // `Date.now()` is the latest stamp after a step forward.
  const stamp = Math.max(Date.now(), mark.wall + Math.ceil(performance.now() - mark.monotonic));
  const mockedTime = vi.getMockedSystemTime()?.getTime();
  if (mockedTime !== undefined) {
    // Fake timers and a call of `vi.setSystemTime` with no fake timers both mock the clock. A
    // mocked clock does not move during the loop below, so the loop would not end.
    // `vi.setSystemTime` runs no timer and moves each pending timer with the clock, but the frames
    // stay at their times. A move of whole frames thus keeps each frame callback in its frame. A
    // frame callback that a part requested before the move runs at the next
    // `vi.advanceTimersToNextFrame()`.
    // With a mocked `Date` and a real `performance.now()`, the stamp can be more than one frame
    // after `Date.now()`.
    // Each move makes a mocked `Date.now()` at least 16 ms later. A part that measures a time with
    // `Date.now()` thus measures at least 16 ms more than its timers waited.
    const frames = Math.max(1, Math.ceil((stamp + 1 - Date.now()) / FAKE_FRAME_DURATION));
    vi.setSystemTime(mockedTime + frames * FAKE_FRAME_DURATION);
  }
  // Fake timers can leave `Date` real. The loop ends only at a later time, so a step back of the
  // wall clock during the loop does not end it. It waits in microtasks, because a case can assert
  // the state before the next task.
  while (!isWallClockLaterThan(stamp)) {
    await Promise.resolve();
  }
}

/**
 * Tells if the wall clock is later than `stamp` in two reads, one directly after the other. On
 * macOS, one read of `Date.now()` can give a time that is some milliseconds later than the read
 * before it and the read after it.
 */
function isWallClockLaterThan(stamp: number) {
  return Date.now() > stamp && Date.now() > stamp;
}

/**
 * Runs `action`, then waits until `Date.now()` is later than each stamp that Vue can give a
 * listener that it attached during `action`. Vue stamps an event with `Date.now()` in the first
 * listener that gets it. It skips each later listener that it attached in that millisecond or
 * after it. Give the action that mounts the target of the next event, so that the event reaches
 * each listener of the target.
 * The function reads the clocks before the action, because a step back during the action cannot
 * be seen after it.
 * @example await waitForLaterMillisecond(() => user.click(trigger));
 * @returns The result of `action`.
 */
export async function waitForLaterMillisecond<Result>(
  action: () => Result,
): Promise<Awaited<Result>> {
  const mark = markClock();
  const result = await action();
  await waitPastStampsSince(mark);
  return result;
}

/**
 * The helpers do not use `@testing-library/vue`, because it depends on another version of
 * `@testing-library/dom`.
 */
export function createRenderer() {
  const mounted: { unmount: () => void; container: HTMLElement }[] = [];

  afterEach(() => {
    // `vi.resetAllMocks()` of the test setup runs after this hook. Without this reset, a console
    // spy that the case did not restore takes each message of the unmount.
    for (const method of ['warn', 'error'] as const) {
      const spy = console[method];
      if (vi.isMockFunction(spy)) {
        spy.mockReset();
      }
    }
    for (const { unmount, container } of mounted.splice(0)) {
      unmount();
      container.remove();
    }
  });

  async function render(element: Renderable): Promise<VaseUIRenderResult> {
    const current = shallowRef(element);
    const app = createTestApp({
      render: () => (typeof current.value === 'function' ? current.value() : current.value),
    });
    recordVueWarnings(app);
    const container = document.createElement('div');
    document.body.append(container);
    const mark = markClock();
    app.mount(container);

    let isMounted = true;
    function unmount() {
      if (isMounted) {
        isMounted = false;
        app.unmount();
      }
    }
    mounted.push({ unmount, container });

    await nextTick();
    await waitPastStampsSince(mark);

    async function rerender(newElement: Renderable) {
      await waitForLaterMillisecond(() => {
        current.value = newElement;
        return nextTick();
      });
    }

    async function setProps(props: Record<string, unknown>) {
      await rerender(
        typeof element === 'function'
          ? () => cloneElement(element(), props)
          : cloneElement(element, props),
      );
    }

    return {
      ...within(document.body),
      container,
      unmount,
      user: userEvent.setup({ document }),
      rerender,
      setProps,
    };
  }

  return { render };
}
