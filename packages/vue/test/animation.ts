/**
 * Waits for the next event of a type on a target. It fails when none comes, so a missing animation
 * gives a message and not a timeout of the test.
 * With `after`, an event of the type counts only when an event of the type `after` came first.
 * Call it before the action, so that the document has a listener of the end event when the
 * transition starts. A late frame can end a transition in the update that starts it, and Chromium
 * then sends no `transitionend` to a listener that comes later.
 */
export function nextEvent(
  target: EventTarget,
  type: string,
  { after }: { after?: string } = {},
): Promise<Event> {
  return new Promise((resolve, reject) => {
    let hasAfterEvent = after === undefined;
    const timer = setTimeout(() => {
      removeListeners();
      reject(
        new Error(
          after === undefined
            ? `No ${type} event came in 3 seconds.`
            : `No ${type} event came after a ${after} event in 3 seconds.`,
        ),
      );
    }, 3000);
    function removeListeners() {
      target.removeEventListener(type, handleEvent);
      if (after !== undefined) {
        target.removeEventListener(after, handleAfterEvent);
      }
    }
    function handleAfterEvent() {
      hasAfterEvent = true;
    }
    function handleEvent(event: Event) {
      if (!hasAfterEvent) {
        return;
      }
      clearTimeout(timer);
      removeListeners();
      resolve(event);
    }
    if (after !== undefined) {
      target.addEventListener(after, handleAfterEvent);
    }
    target.addEventListener(type, handleEvent);
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

/**
 * Tells if a frame paints between the end of the exit animation and the removal of the panel.
 * The reaction to the end reads the time of the timeline and requests one frame. If the removal
 * is done in that frame callback, no frame ran between the end and the removal. The time of the
 * callback shows that it belongs to the frame of the end.
 */
export function probeFrameAfterExit(panel: HTMLElement, isGone: () => boolean) {
  return new Promise<FrameProbeResult>((resolve, reject) => {
    const animations = panel.getAnimations();
    if (animations.length === 0) {
      reject(new Error('The panel has no animation to wait for.'));
      return;
    }
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      const endTime = Number(document.timeline.currentTime);
      requestAnimationFrame((frameTime) => {
        resolve({ isGone: isGone(), isSameFrame: Math.abs(frameTime - endTime) < 0.5 });
      });
    }, reject);
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
