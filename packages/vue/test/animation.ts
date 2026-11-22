import { expect } from 'vitest';
import { waitFor } from './waitFor';

const EVENT_FRAMES = 180;

/**
 * Resolves or rejects as the wait that `attach` starts. It runs `action` after `attach`, and it
 * rejects with `message` when the wait does not end in `frames` frames of the page after `action`
 * ends. `attach` returns a function that removes the wait.
 * The limit is in frames of the page and not in seconds. A busy machine can stall the page for
 * some seconds, and a limit in seconds can end during the stall. The page renders no frame during
 * a stall, so the stall uses no frame of the limit. The browser ends a transition or an animation
 * only in a frame.
 */
function waitWithFrameLimit<T>(
  { frames, message, action }: { frames: number; message: string; action?: () => unknown },
  attach: (resolve: (value: T) => void, reject: (error: Error) => void) => () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    let frameRequest = 0;
    let detach = () => {};

    function settle() {
      isSettled = true;
      cancelAnimationFrame(frameRequest);
      detach();
    }
    function countFrames(remaining: number) {
      frameRequest = requestAnimationFrame(() => {
        if (remaining > 1) {
          countFrames(remaining - 1);
          return;
        }
        settle();
        reject(new Error(message));
      });
    }

    detach = attach(
      (value) => {
        settle();
        resolve(value);
      },
      (error) => {
        settle();
        reject(error);
      },
    );
    // eslint-disable-next-line @typescript-eslint/require-await -- The async function turns a throw of `action` into a rejection.
    (async () => action?.())().then(
      () => {
        if (!isSettled) {
          countFrames(frames);
        }
      },
      (error: unknown) => {
        settle();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- The helper passes on the value that `action` threw.
        reject(error);
      },
    );
  });
}

/**
 * Waits for the next event of a type on a target. It fails when none comes in 180 frames of the
 * page, so a missing animation gives a message and not a timeout of the test.
 * With `after`, an event of the type counts only when an event of the type `after` came first.
 * With `action`, the function runs after the listeners are attached, and the count of frames
 * starts when it ends. A command of the browser, such as a real click, can take some seconds on a
 * busy machine, and the page renders frames during that time.
 * Attach the listeners before the action, so that the document has a listener of the end event
 * when the transition starts. A late frame can end a transition in the update that starts it, and
 * Chromium then sends no `transitionend` to a listener that comes later.
 */
export function nextEvent(
  target: EventTarget,
  type: string,
  { after, action }: { after?: string; action?: () => unknown } = {},
): Promise<Event> {
  const message =
    after === undefined
      ? `No ${type} event came in ${EVENT_FRAMES} frames of the page.`
      : `No ${type} event came after a ${after} event in ${EVENT_FRAMES} frames of the page.`;

  return waitWithFrameLimit({ frames: EVENT_FRAMES, message, action }, (resolve) => {
    let hasAfterEvent = after === undefined;
    function handleAfterEvent() {
      hasAfterEvent = true;
    }
    function handleEvent(event: Event) {
      if (hasAfterEvent) {
        resolve(event);
      }
    }

    if (after !== undefined) {
      target.addEventListener(after, handleAfterEvent);
    }
    target.addEventListener(type, handleEvent);
    return () => {
      target.removeEventListener(type, handleEvent);
      if (after !== undefined) {
        target.removeEventListener(after, handleAfterEvent);
      }
    };
  });
}

/**
 * Waits until `element` has an animation or a transition, and ends each one with `finish()`. A case
 * gives such an animation a duration of 100 s, so that its state stays until the case ends it. A
 * `<Transition>` then gets the end event.
 */
export async function finishAnimations(element: Element) {
  await waitFor(() => expect(element.getAnimations().length).toBeGreaterThan(0));
  for (const animation of element.getAnimations()) animation.finish();
}
