import { afterEach, beforeAll, beforeEach, onTestFinished, vi } from 'vitest';
import { reset } from '../src/common/error';
import { resetAnimationFrameScheduler } from '../src/common/useAnimationFrame';
import { failOnReportedMessages } from './reportedMessages';

declare module 'vitest/browser' {
  interface BrowserCommands {
    collectGarbage: () => Promise<void>;
  }
}

failOnReportedMessages();

// `css.escape`, a dependency of jest-dom, defines the global `CSS`. In Node, that global hides
// the `ReferenceError` that code gets on a server when it uses `CSS` with no check.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

if (typeof document !== 'undefined') {
  // Fake timers replace the global `setTimeout`. This reference stays the timer of the browser.
  const browserSetTimeout = globalThis.setTimeout;
  const { commands, server, userEvent } = await import('vitest/browser');

  // Firefox collects the garbage of the earlier test files of the page late. One cycle collection
  // then visits millions of objects and stops the page for some seconds, in the test that runs at
  // that time. A full garbage collection and cycle collection before the first test of each file
  // keep each collection small.
  if (server.browser === 'firefox') {
    beforeAll(async () => {
      await commands.collectGarbage();
    });
  }

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

  // In Chromium on Linux, a real touch drag can end with a fling that continues after the test. The
  // first touch of a later test then stops the fling, and it gets no compatibility mouse events and
  // no `click` (N11 of `test/measurements/popup.test.ts`). A touch that moves sends a `pointermove`,
  // also before the `pointercancel` of a drag that the browser takes. After a test with a touch
  // `pointermove`, the setup stops a fling.
  let hasTouchMoved = false;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.isTrusted && event.pointerType === 'touch') {
        hasTouchMoved = true;
      }
    },
    { capture: true },
  );

  // A Firefox validation popup can take real presses in the next test. Firefox listens for blur
  // after it focuses the invalid control. It misses the blur if the control redirects focus, as a
  // radio's hidden input does. Removing a focused control can also leave the popup open.
  // A native invalid event in a shadow root or a nested frame does not reach this window.
  let hadInvalidEvent = false;
  if (server.browser === 'firefox') {
    window.addEventListener(
      'invalid',
      (event) => {
        if (event.isTrusted) {
          hadInvalidEvent = true;
        }
      },
      { capture: true },
    );
  }

  // Firefox follows the new control, so its blur closes even a popup that has yet to appear.
  function closeValidationPopup() {
    const input = document.createElement('input');
    input.required = true;
    document.body.append(input);
    input.reportValidity();
    input.blur();
    input.remove();
    // reportValidity() fired another trusted invalid event.
    hadInvalidEvent = false;
  }

  // A submit that no listener prevents loads another page in the frame of the tests. This listener
  // on the window runs after each listener of the document and of the form.
  window.addEventListener('submit', (event) => event.preventDefault());

  // Whether a browser gives a pointer lock to the page of a test depends on the engine and on the
  // platform. With a lock, Firefox puts a second pointer in the page. The move below does not take
  // that pointer off the page, and it gives hover events to each later test file of the page.
  Element.prototype.requestPointerLock = () =>
    Promise.reject(new DOMException('The test setup refuses a pointer lock.', 'NotSupportedError'));

  // A test that times out in a command of `userEvent` ends while the browser still does the
  // command. Without a wait for the command, its keys and pointer moves reach the next test. A key
  // that it holds also stays down there, because Vitest releases before each test only the keys of
  // the commands that returned. The wrapper below awaits each command, so Vitest does not fail a
  // test that does not await a call. ESLint refuses such a call when it has no `void`.
  //
  // After a time-out, the function of the test continues when its command ends. When the command
  // ends after the hook below starts, the wrapper rejects, so the next steps of the function do not
  // run in the next test. Only the `catch` and `finally` blocks of the function run. A command that
  // the function starts after a wait of another kind, such as a frame, can still run in the next
  // test. The `onTestFinished` hooks of the test run before that hook, so a release in such a hook
  // does not reject.
  const runningCommands = new Set<Promise<void>>();
  let endedTestCount = 0;
  for (const name of [
    'click',
    'dblClick',
    'tripleClick',
    'wheel',
    'pointer',
    'selectOptions',
    'keyboard',
    'type',
    'clear',
    'tab',
    'hover',
    'unhover',
    'upload',
    'copy',
    'cut',
    'paste',
    'fill',
    'dragAndDrop',
  ] as const) {
    const command: (...args: never[]) => Promise<void> = userEvent[name].bind(userEvent);
    Object.defineProperty(userEvent, name, {
      async value(...args: never[]) {
        const endedTestCountAtCall = endedTestCount;
        const running = command(...args);
        runningCommands.add(running);
        try {
          await running;
        } finally {
          runningCommands.delete(running);
        }
        if (endedTestCount !== endedTestCountAtCall) {
          throw new Error(`The test ended before the command userEvent.${name} ended.`);
        }
      },
    });
  }

  // A test in a browser ends with one wait, so that the next test starts in a new task. Without the
  // wait, a test that ends in a `ResizeObserver` callback gives the next test the loop error of the
  // browser. A 0 ms timer that the test set in its last task runs before the new task. The browser
  // delays a timer by 4 ms or more when timers nest more than five deep, so a delayed timer that
  // the test set in an earlier task can run in the next test. Vitest runs the `onTestFinished`
  // hooks after the `afterEach` hooks and in reverse order. This hook is the second that a test
  // registers, after the hook of `failOnReportedMessages`. The wait for the commands, the close of
  // the validation popup, the stop of a fling, the pointer move and the wait for a timer then run
  // after each unmount and before the check of the messages. A command can put the pointer in the
  // page, so the move comes after the wait for the commands.
  beforeEach(() => {
    onTestFinished(async () => {
      endedTestCount += 1;
      await Promise.allSettled(runningCommands);
      if (hadInvalidEvent) {
        closeValidationPopup();
      }
      // The touch that stops a fling puts a pointer in the page, so it comes before the move.
      if (hasTouchMoved) {
        hasTouchMoved = false;
        const { stopFling } = await import('./pointer');
        await stopFling();
      }
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
