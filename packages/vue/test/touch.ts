import { fireEvent } from './fireEvent';

type TouchPoint = { clientX: number; clientY: number };

interface TouchLists {
  touches?: TouchPoint[];
  changedTouches?: TouchPoint[];
}

type TouchType = 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel';

function createTouchEvent(type: TouchType, target: Element, lists: TouchLists) {
  const { touches = [], changedTouches = [] } = lists;
  const eventInit = { bubbles: true, cancelable: true, composed: true };

  try {
    const toTouchList = (points: TouchPoint[]) =>
      points.map((point, index) => new Touch({ identifier: index + 1, target, ...point }));

    return new TouchEvent(type, {
      ...eventInit,
      touches: toTouchList(touches),
      targetTouches: toTouchList(touches),
      changedTouches: toTouchList(changedTouches),
    });
  } catch {
    // WebKit on a desktop cannot construct a `Touch`. A listener reads the same members from this
    // event.
    const event = new Event(type, eventInit);
    Object.defineProperties(event, {
      touches: { value: touches },
      targetTouches: { value: touches },
      changedTouches: { value: changedTouches },
    });
    return event;
  }
}

function fire(type: TouchType) {
  return (element: Element, lists: TouchLists = {}) =>
    fireEvent(element, createTouchEvent(type, element, lists));
}

/**
 * Fires touch events that have `touches`, `targetTouches` and `changedTouches` in each browser.
 */
export const fireTouch = {
  start: fire('touchstart'),
  move: fire('touchmove'),
  end: fire('touchend'),
  cancel: fire('touchcancel'),
};
