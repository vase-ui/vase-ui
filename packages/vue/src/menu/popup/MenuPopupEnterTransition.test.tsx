import { afterEach, describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import { AnimationFrame } from '../../common/useAnimationFrame';
import { Timeout } from '../../common/useTimeout';
import { createRenderer, isJSDOM, screen, waitFor } from '#test-utils';

const activeTrackers: Array<{ stop(): void }> = [];
const activeTimeouts: Timeout[] = [];

/**
 * Records whether `selector` ever matches an element. Polls per frame because the tracked
 * attributes may be present for only a single frame. Uses the managed `AnimationFrame` scheduler
 * so the loop cannot outlive its test: `stop()` cancels the pending frame, and every tracker is
 * also stopped in `afterEach` in case a test fails before reaching `stop()`.
 */
function trackSelector(selector: string) {
  let seen = false;
  let frame: number;

  function sample() {
    if (document.querySelector(selector)) {
      seen = true;
    }
    frame = AnimationFrame.request(sample);
  }
  frame = AnimationFrame.request(sample);

  const tracker = {
    seen: () => seen,
    stop() {
      AnimationFrame.cancel(frame);
    },
  };
  activeTrackers.push(tracker);
  return tracker;
}

/**
 * Records whether an element ever carries `[data-starting-style]`, which is what drives the enter
 * transition.
 */
function trackStartingStyle(testId: string) {
  return trackSelector(`[data-testid="${testId}"][data-starting-style]`);
}

/**
 * Waits using the managed timeout scheduler instead of a raw global timer, so an interrupted test
 * cannot leak a pending callback into a later one. Every timeout is cleared in `afterEach`.
 */
async function waitMs(ms: number) {
  const timeout = Timeout.create();
  activeTimeouts.push(timeout);
  await new Promise<void>((resolve) => {
    timeout.start(ms, resolve);
  });
}

describe.skipIf(isJSDOM)('Menu enter transition', () => {
  const { render } = createRenderer();

  afterEach(() => {
    activeTrackers.splice(0).forEach((tracker) => tracker.stop());
    activeTimeouts.splice(0).forEach((timeout) => timeout.clear());
  });

  it('does not play the enter transition for a menu that is open on the first render', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const menuTracker = trackStartingStyle('menu-popup');

    await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });

    await waitMs(100);

    expect(menuTracker.seen()).toBe(false);
  });
});
