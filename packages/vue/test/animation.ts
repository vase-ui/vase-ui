const EVENT_FRAMES = 180;
const GUARD_FRAMES = 600;

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
 * Resolves with the list that the next `getAnimations()` call on the element returns. A part makes
 * that call when it starts to wait for the animations of the element. It then waits for the
 * animations of that list, and it attaches to each of them before the test continues.
 * It fails when no call comes in 600 frames of the page. With `action`, the function runs after
 * this function replaced `getAnimations` of the element, and the count of frames starts when it
 * ends, as in `nextEvent`.
 * Call it before the action, or give it the action. With three or more elements in one frame, a
 * part can get the animations of an element from the root of the tree. This function does not see
 * that read.
 */
export function nextAnimationsRead(
  element: Element,
  { action }: { action?: () => unknown } = {},
): Promise<Animation[]> {
  const message = `No part read the animations of the element in ${GUARD_FRAMES} frames of the page.`;

  return waitWithFrameLimit({ frames: GUARD_FRAMES, message, action }, (resolve) => {
    element.getAnimations = (options) => {
      Reflect.deleteProperty(element, 'getAnimations');
      const animations = element.getAnimations(options);
      resolve(animations);
      return animations;
    };
    return () => {
      Reflect.deleteProperty(element, 'getAnimations');
    };
  });
}

export function openInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = true;
  });
}

export function closeInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = false;
  });
}

export interface FrameProbeResult {
  /** The panel was `hidden` or not connected in the callback of the frame. */
  isGone: boolean;
  /** The callback of the frame has the time of the frame in which the animation ended. */
  isSameFrame: boolean;
}

const MINIMUM_EXIT_DURATION = 10_000;
const SEEK_MARGIN = 50;

/**
 * Tells if a frame paints between the end of the exit animation and the removal of the panel.
 * The exit must last 100 s. A part reads its animations some frames after the close, and a late
 * frame can end a short exit before that read. The part then finds no animation to wait for.
 * The probe calls `close` and waits until the part reads the animations of the panel. Then it
 * moves each animation to 50 ms before its end. The browser ends the exit in a frame, as it does
 * for a user, and no call of the test ends it.
 * The reaction to the end reads the time of the timeline and requests one frame. If the removal
 * is done in that frame callback, no frame ran between the end and the removal. The time of the
 * callback shows that it belongs to the frame of the end.
 * It rejects when the part finds no animation, and when the panel goes before the end of the exit:
 * the browser then cancels the animation.
 * The probe reads `isGone` in one callback of the frame of the end. A removal in a later callback
 * of that frame is before the paint, but the probe reports it as late. A part that waits for
 * `finished` removes the panel in the microtasks before each callback, so the limit does not
 * apply to it.
 */
export async function probeFrameAfterExit(
  panel: HTMLElement,
  isGone: () => boolean,
  close: () => void,
): Promise<FrameProbeResult> {
  const read = nextAnimationsRead(panel);
  close();
  const animations = await read;
  if (animations.length === 0) {
    throw new Error('The part found no exit animation on the panel.');
  }
  const endTimes = animations.map((animation) =>
    Number(animation.effect!.getComputedTiming().endTime),
  );
  if (endTimes.some((endTime) => endTime < MINIMUM_EXIT_DURATION)) {
    throw new Error(
      'The exit animation of the panel lasts less than 10 seconds. Give the exit a duration of 100 s.',
    );
  }
  animations.forEach((animation, index) => {
    animation.currentTime = endTimes[index] - SEEK_MARGIN;
  });

  await waitWithFrameLimit<void>(
    {
      frames: GUARD_FRAMES,
      message: `The exit animation did not end in ${GUARD_FRAMES} frames of the page.`,
    },
    (resolve, reject) => {
      Promise.all(animations.map((animation) => animation.finished)).then(
        () => resolve(),
        () =>
          reject(
            new Error(
              'The browser canceled the exit animation. The panel went before the end of the exit.',
            ),
          ),
      );
      return () => {};
    },
  );
  const endTime = Number(document.timeline.currentTime);
  return new Promise<FrameProbeResult>((resolve) => {
    requestAnimationFrame((frameTime) => {
      resolve({ isGone: isGone(), isSameFrame: Math.abs(frameTime - endTime) < 0.5 });
    });
  });
}

/**
 * Counts the `transitionrun` events of one element for each phase. A test gives `onTransitionrun`
 * to the part as an attribute, so the listener is on the element. A browser can send the event
 * after the part removed the element, and an ancestor does not get such an event.
 * The open state at the event gives the phase. The next change of the state is in a later task,
 * after the event of the transition that the last change made.
 */
export function createTransitionRunCounter(isOpen: () => boolean) {
  const counts = { enter: 0, exit: 0 };

  return {
    counts,
    onTransitionrun: (event: Event) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      counts[isOpen() ? 'enter' : 'exit'] += 1;
    },
  };
}
