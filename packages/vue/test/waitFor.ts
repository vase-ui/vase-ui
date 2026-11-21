import { getConfig } from '@testing-library/dom';
import { endedTests } from './endedTests';

const WAIT_FRAMES = 180;

// Fake timers replace the global functions. These references stay the functions of the browser.
const browserRequestAnimationFrame = globalThis.requestAnimationFrame;
const browserCancelAnimationFrame = globalThis.cancelAnimationFrame;

const PROMISE_REFUSAL_MESSAGE =
  'The callback of `waitFor` returned a promise. `waitFor` does not wait for a promise, and it does not call the callback again after a rejection. Await the action first. Then give `waitFor` a synchronous callback.';

// The wait of Testing Library sets this field around each call of its callback, and the package
// does not export the function that does it. While the field is `true`, a failed `getByRole` skips
// the report of the roles of its container.
type ConfigWithDiagnosticsFlag = ReturnType<typeof getConfig> & {
  _disableExpensiveErrorDiagnostics: boolean;
};

function callWithoutRoleReport<T>(callback: () => T): T {
  // `configure` replaces the config object, so each call reads it again.
  const config = getConfig() as ConfigWithDiagnosticsFlag;
  try {
    config._disableExpensiveErrorDiagnostics = true;
    return callback();
  } finally {
    config._disableExpensiveErrorDiagnostics = false;
  }
}

function isPromiseLike(value: unknown): boolean {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}

/**
 * Calls `callback` until it does not throw, and resolves with its result. It calls `callback` at
 * once, after each change of the DOM of the page, and in each frame. It rejects with the last error
 * of `callback` when the page rendered 180 frames and no call passed. The message of that error has
 * the DOM of the page, or of the container of a failed query.
 * The limit is in frames of the page and not in seconds. A busy machine can stall the page for
 * some seconds, and a limit in seconds can end during the stall. The page renders no frame during
 * a stall, so the stall uses no frame of the limit.
 * The frames are frames of the browser, also under fake timers.
 * A failed `getByRole` in `callback` gives its short error in each call but the last one. The
 * last call gives the full error, which reports the roles of the container.
 * It rejects with a `TypeError` when `callback` returns a promise, and it does not call `callback`
 * again. Testing Library waits for such a promise, and it calls `callback` again after a rejection.
 * It rejects when its test ends first. After a time-out, the function of the test goes on when its
 * wait ends, and the rejection stops it there, so its next steps do not run in the next test.
 */
export function waitFor<T>(callback: () => T): Promise<T> {
  const endedAtCall = endedTests();
  return new Promise<T>((resolve, reject) => {
    let remainingFrames = WAIT_FRAMES;
    let lastError: unknown;
    let frameRequest = 0;
    let isSettled = false;
    const observer = new MutationObserver(() => {
      check(false);
    });

    function settle() {
      isSettled = true;
      browserCancelAnimationFrame(frameRequest);
      observer.disconnect();
    }
    function check(isLastCall: boolean) {
      if (isSettled) {
        return;
      }
      if (endedTests() !== endedAtCall) {
        settle();
        reject(new Error('The test ended before `waitFor` ended.'));
        return;
      }
      try {
        const result = isLastCall ? callback() : callWithoutRoleReport(callback);
        settle();
        if (isPromiseLike(result)) {
          reject(new TypeError(PROMISE_REFUSAL_MESSAGE));
        } else {
          resolve(result);
        }
      } catch (error) {
        lastError = error;
      }
    }
    function checkInFrame() {
      check(remainingFrames === 1);
      if (isSettled) {
        return;
      }
      remainingFrames -= 1;
      if (remainingFrames === 0) {
        settle();
        // An error of a query has the DOM of its container already. The wait of Testing Library puts
        // the DOM in each error, so this wait puts it in each other error. The message of a
        // `DOMException` has only a getter, so an assignment to it throws.
        if (lastError instanceof Error && lastError.name !== 'TestingLibraryElementError') {
          Object.defineProperty(lastError, 'message', {
            value: getConfig().getElementError(lastError.message, document.body).message,
          });
        }
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The helper rejects with the value that `callback` threw.
        reject(lastError);
        return;
      }
      frameRequest = browserRequestAnimationFrame(checkInFrame);
    }

    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    check(false);
    if (!isSettled) {
      frameRequest = browserRequestAnimationFrame(checkInFrame);
    }
  });
}
