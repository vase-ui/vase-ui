import { afterEach, beforeEach, onTestFinished, vi } from 'vitest';
import { reset } from '../src/common/error';
import { resetAnimationFrameScheduler } from '../src/common/useAnimationFrame';
import { failOnReportedMessages } from './reportedMessages';

failOnReportedMessages();

// `css.escape`, a dependency of jest-dom, defines the global `CSS`. In Node, that global hides
// the `ReferenceError` that code gets on a server when it uses `CSS` with no check.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

if (typeof document !== 'undefined') {
  // Fake timers replace the global `setTimeout`. This reference stays the timer of the browser.
  const browserSetTimeout = globalThis.setTimeout;
  const { userEvent } = await import('vitest/browser');

  // The browser keeps its real pointer where a test leaves it. Some frames later, an element that a
  // later test renders under the pointer gets trusted hover events, and a hover popup of that test
  // opens or closes by itself. The page gets `pointerover` on the frame element when the pointer
  // goes into a frame, so this listener also sees a press in a frame.
  let isPointerInPage = false;
  window.addEventListener(
    'pointerover',
    (event) => {
      if (event.isTrusted) {
        isPointerInPage = true;
      }
    },
    { capture: true },
  );

  // A test in a browser ends with one wait, so that the next test starts in a new task. Without the
  // wait, a test that ends in a `ResizeObserver` callback gives the next test the loop error of the
  // browser. Vitest runs the `onTestFinished` hooks after the `afterEach` hooks and in reverse
  // order. This hook is the second that a test registers, after the hook of
  // `failOnReportedMessages`. The pointer move and the wait then run after each unmount and before
  // the check of the messages.
  beforeEach(() => {
    onTestFinished(async () => {
      if (isPointerInPage) {
        isPointerInPage = false;
        // A point outside the page.
        await userEvent.pointer({ coords: { x: -1, y: -1 } });
      }
      await new Promise<void>((resolve) => {
        browserSetTimeout(resolve, 0);
      });
    });
  });
}

// Animations are off in each test. A test that needs a real animation sets this to `false`.
globalThis.VASE_UI_ANIMATIONS_DISABLED = true;

afterEach(() => {
  vi.resetAllMocks();
  globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  // `warn` and `error` share one log-once store, so this also clears the warnings that it holds.
  reset();
  // Drops animation frame callbacks that were scheduled and never ran, for example when fake timers
  // end before the frame fires. The scheduler is global to the process.
  resetAnimationFrameScheduler();
});
