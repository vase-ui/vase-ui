import type { CDPSession } from '@vitest/browser-playwright';
import { createEvent } from '@testing-library/dom';
import { onTestFinished } from 'vitest';
import { server, userEvent } from 'vitest/browser';
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

/**
 * Returns the client point of the center of `element` as the init of a mouse event. A dispatched
 * mouse event with no point has the point (0, 0).
 */
export function clientCenter(element: Element) {
  const rect = element.getBoundingClientRect();
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
}

/**
 * Presses the main button of the real pointer at the center of `element` and holds it. `release`
 * lets the button go at the same point, or at `to`. A case that does not call it gets the release
 * at the same point when it ends.
 */
export async function holdPress(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  const point = { x: clientX, y: clientY };
  let held = true;
  async function release(to: ClientPoint = point) {
    held = false;
    await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
  }
  onTestFinished(async () => {
    if (held) {
      await release();
    }
  });
  await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
  return { point, release };
}

/**
 * Drags with the real pointer, as `userEvent.dragAndDrop`. WebKit ends the drag of a draggable
 * element with no `pointerup` and no `pointercancel`. The page then keeps the button pressed, and
 * its next press gives no `pointerdown`. Vitest runs later test files in the same page. In WebKit,
 * the helper thus releases the button off the page when the case ends.
 */
export async function dragAndDrop(...args: Parameters<typeof userEvent.dragAndDrop>) {
  if (server.browser === 'webkit') {
    onTestFinished(() => userEvent.pointer({ coords: { x: -1, y: -1 }, keys: '[/MouseLeft]' }));
  }
  // eslint-disable-next-line no-restricted-properties -- This helper is the one call of the command.
  await userEvent.dragAndDrop(...args);
}

interface ClientPoint {
  x: number;
  y: number;
}

// The protocol takes the coordinates of the top-level page, and the tester renders inside a scaled
// iframe.
function getProtocolPoint(point: ClientPoint): ClientPoint {
  const frameRect = window.frameElement?.getBoundingClientRect() ?? new DOMRect();
  const scale = frameRect.width / window.innerWidth || 1;
  return { x: frameRect.left + point.x * scale, y: frameRect.top + point.y * scale };
}

function getPointOnLine(from: ClientPoint, to: ClientPoint, step: number, steps: number) {
  return {
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  };
}

/**
 * Drags a real touch from one client point of the test page to another, in `steps` moves, and lifts
 * it at the last point after `rest` milliseconds. With no moves, it taps. Only Chromium has the
 * protocol that the helper uses: guard a case that calls it with `it.skipIf(!platform.engine.blink)`.
 */
export async function touchDrag(from: ClientPoint, to: ClientPoint, steps = 6, rest = 0) {
  // Each engine loads this file, and only Chromium has a session. The import is lazy, as in the
  // other cases that call `cdp()`.
  const { cdp } = await import('vitest/browser');
  const session = cdp() as CDPSession;
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: ClientPoint) =>
    session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point ? [getProtocolPoint(point)] : [],
    });
  await send('touchStart', from);
  try {
    for (let step = 1; step <= steps; step += 1) {
      await send('touchMove', getPointOnLine(from, to, step, steps));
    }
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
  } finally {
    await send('touchEnd');
  }
}

/**
 * Sends one real touch event at the client points that touch the page after it. Only Chromium has
 * the protocol that the helper uses: guard a case that calls it with `it.skipIf(!platform.engine.blink)`.
 */
export async function sendTouch(
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  points: ClientPoint[],
) {
  const { cdp } = await import('vitest/browser');
  await (cdp() as CDPSession).send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(getProtocolPoint),
  });
}

/**
 * Drags a real pen from one client point of the test page to another, in `steps` moves, and lifts it
 * at the last point after `rest` milliseconds. The pen then moves out of the test page, so it hovers over no element that a
 * later test renders. Only Chromium has the protocol that the helper uses: guard a case that calls
 * it with `it.skipIf(!platform.engine.blink)`.
 */
export async function penDrag(from: ClientPoint, to: ClientPoint, steps = 4, rest = 0) {
  const { cdp } = await import('vitest/browser');
  const session = cdp() as CDPSession;
  const send = (
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    point: ClientPoint,
    buttons: number,
  ) =>
    session.send('Input.dispatchMouseEvent', {
      type,
      ...getProtocolPoint(point),
      button: type === 'mouseMoved' && buttons === 0 ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType: 'pen',
    });
  await send('mouseMoved', from, 0);
  await send('mousePressed', from, 1);
  try {
    for (let step = 1; step <= steps; step += 1) {
      await send('mouseMoved', getPointOnLine(from, to, step, steps), 1);
    }
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
  } finally {
    await send('mouseReleased', to, 0);
    await send('mouseMoved', { x: -10, y: -10 }, 0);
  }
}
