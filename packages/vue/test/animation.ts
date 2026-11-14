/**
 * Waits for the next event of a type on a target. It fails when none comes, so a missing animation
 * gives a message and not a timeout of the test.
 * With `after`, an event of the type counts only when an event of the type `after` came first.
 * With `action`, the function runs after the listeners are attached, and the 3 seconds start when
 * it ends. A command of the browser, such as a real click, can take more than 3 seconds on a busy
 * machine.
 * Attach the listeners before the action, so that the document has a listener of the end event
 * when the transition starts. A late frame can end a transition in the update that starts it, and
 * Chromium then sends no `transitionend` to a listener that comes later.
 */
export function nextEvent(
  target: EventTarget,
  type: string,
  { after, action }: { after?: string; action?: () => unknown } = {},
): Promise<Event> {
  return new Promise((resolve, reject) => {
    let hasAfterEvent = after === undefined;
    let isSettled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function settle() {
      isSettled = true;
      clearTimeout(timer);
      target.removeEventListener(type, handleEvent);
      if (after !== undefined) {
        target.removeEventListener(after, handleAfterEvent);
      }
    }
    function handleAfterEvent() {
      hasAfterEvent = true;
    }
    function handleEvent(event: Event) {
      if (hasAfterEvent) {
        settle();
        resolve(event);
      }
    }
    function startTimer() {
      if (isSettled) {
        return;
      }
      timer = setTimeout(() => {
        settle();
        reject(
          new Error(
            after === undefined
              ? `No ${type} event came in 3 seconds.`
              : `No ${type} event came after a ${after} event in 3 seconds.`,
          ),
        );
      }, 3000);
    }

    if (after !== undefined) {
      target.addEventListener(after, handleAfterEvent);
    }
    target.addEventListener(type, handleEvent);
    (async () => action?.())().then(startTimer, (error: unknown) => {
      settle();
      reject(error);
    });
  });
}

const GUARD_DURATION = 10_000;

/**
 * Resolves with the list that the next `getAnimations()` call on the element returns. A part makes
 * that call when it starts to wait for the animations of the element. It then waits for the
 * animations of that list, and it attaches to each of them before the test continues.
 * It fails when no call comes in 10 seconds. A busy machine can stall the page for some seconds,
 * and a part that is right makes its call after the stall. The time starts when the function is
 * called, so start the action in a timer task or with an event. A command of the browser can take
 * longer.
 * Call it before the action. With three or more elements in one frame, a part can get the
 * animations of an element from the root of the tree. This function does not see that read.
 */
export function nextAnimationsRead(element: Element): Promise<Animation[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      Reflect.deleteProperty(element, 'getAnimations');
      reject(new Error('No part read the animations of the element in 10 seconds.'));
    }, GUARD_DURATION);
    element.getAnimations = (options) => {
      Reflect.deleteProperty(element, 'getAnimations');
      clearTimeout(timer);
      const animations = element.getAnimations(options);
      resolve(animations);
      return animations;
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

  return new Promise<FrameProbeResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('The exit animation did not end in 10 seconds.'));
    }, GUARD_DURATION);
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        clearTimeout(timer);
        const endTime = Number(document.timeline.currentTime);
        requestAnimationFrame((frameTime) => {
          resolve({ isGone: isGone(), isSameFrame: Math.abs(frameTime - endTime) < 0.5 });
        });
      },
      () => {
        clearTimeout(timer);
        reject(
          new Error(
            'The browser canceled the exit animation. The panel went before the end of the exit.',
          ),
        );
      },
    );
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
