import { createEvent } from '@testing-library/dom';
import { fireEvent } from './fireEvent';

export async function enterWithMouse(element: HTMLElement, init?: MouseEventInit) {
  await fireEvent.pointerEnter(element, { pointerType: 'mouse', ...init });
  await fireEvent.mouseEnter(element, init);
  await fireEvent.mouseMove(element, init);
}

export async function moveMouse(from: HTMLElement, to: HTMLElement) {
  await fireEvent.pointerLeave(from, {
    pointerType: 'mouse',
    relatedTarget: to,
  });
  await fireEvent.mouseLeave(from, { relatedTarget: to });
  await fireEvent.pointerEnter(to, {
    pointerType: 'mouse',
    relatedTarget: from,
  });
  await fireEvent.mouseEnter(to, { relatedTarget: from });
  await fireEvent.mouseMove(to);
}

// `timeStamp` is required. Without it, the event gets the real clock of the browser, which is the
// dependency that these helpers remove.
type PointerInit = PointerEventInit & { timeStamp: number };

function firePointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  element: Element,
  init: PointerInit,
) {
  const { timeStamp, ...eventInit } = init;

  if (!(timeStamp > 0)) {
    // Code that reads the gesture speed rejects a stamp of 0 or less, such as `getValidTimeStamp`
    // in `useSwipeDismiss`. It reads the real clock in its place.
    throw new Error(`firePointer: timeStamp must be greater than 0, received ${timeStamp}.`);
  }

  const event = createEvent[type](element, eventInit);

  // `timeStamp` is read-only and is not a member of `PointerEventInit`, so a browser stamps the
  // event with its own monotonic clock. The event then carries the real time between two calls,
  // which differs from run to run.
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });

  return fireEvent(element, event);
}

/**
 * Fires pointer events that carry the `timeStamp` that they get, so that a test of the gesture
 * speed describes a fixed timeline.
 */
export const firePointer = {
  down: (element: Element, init: PointerInit) => firePointerEvent('pointerDown', element, init),
  move: (element: Element, init: PointerInit) => firePointerEvent('pointerMove', element, init),
  up: (element: Element, init: PointerInit) => firePointerEvent('pointerUp', element, init),
};

/**
 * Presses an element the way a touch screen does before the click: a touch `pointerdown`
 * followed by the compatibility `mousedown`.
 */
export async function pressWithTouch(element: HTMLElement) {
  await fireEvent.pointerDown(element, { pointerType: 'touch' });
  await fireEvent.mouseDown(element);
}

/**
 * Presses an element the way Chrome performs a screen reader activation (TalkBack, VoiceOver,
 * NVDA): a zero-pressure 1x1 mouse press with no buttons, followed by a `detail: 0` click.
 */
export async function pressWithScreenReader(element: Element) {
  const pointerInit = { pointerType: 'mouse', width: 1, height: 1, pressure: 0 };
  await fireEvent.pointerDown(element, { ...pointerInit, detail: 0, buttons: 0 });
  await fireEvent.mouseDown(element, { detail: 0 });
  await fireEvent.pointerUp(element, pointerInit);
  await fireEvent.mouseUp(element, { detail: 0 });
  await fireEvent.click(element, { detail: 0 });
}
