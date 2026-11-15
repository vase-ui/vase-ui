import type { HandleDrag } from './handleDrag';
import { getHandlesAtPoint } from './handleRegistry';
import type { PressedHandle } from './handleRegistry';

export interface HandlePressListeners {
  onPointerdown: (event: PointerEvent) => void;
  onPointermove: (event: PointerEvent) => void;
  onPointerup: (event: PointerEvent) => void;
  onPointercancel: (event: PointerEvent) => void;
  onLostpointercapture: (event: PointerEvent) => void;
  onPointerleave: () => void;
  onMousedown: (event: MouseEvent) => void;
  onClickCapture: (event: MouseEvent) => void;
}

export interface HandlePress {
  /**
   * The listeners of the pointer session. Bind them on the handle element, or on each node of an
   * edge.
   */
  listeners: HandlePressListeners;
  /**
   * Starts the press with the `pointerdown` event. It returns `false` when the drag of the pressed
   * handle does not start. A listener of the handle that needs the result uses this function in
   * place of `listeners.onPointerdown`.
   */
  start: (event: PointerEvent) => boolean;
  /**
   * Ends the press and each of its drags without a layout, for a change of the lifecycle of the
   * pressed handle. The call changes nothing when no press runs.
   */
  end: () => void;
}

/**
 * The pointer session of a handle or an edge. A press on `own` also drags each handle and each edge
 * of another root that the press crosses, so the press holds a list of drags. It holds the pointer
 * capture and the rule for the click that follows.
 */
export function createHandlePress(own: PressedHandle): HandlePress {
  // The drags that the press started, with the drag of `own` first. With no press it is empty.
  let drags: readonly HandleDrag[] = [];
  let pointerId = 0;
  let captured: HTMLElement | undefined;
  let startX = 0;
  let startY = 0;
  let moved = false;
  // Whether the next click is the click that follows a press in which the pointer moved. The next
  // press clears it, so no timer is needed.
  let stopClick = false;

  function finish(event: PointerEvent | undefined, apply: boolean) {
    const ended = drags;
    if (ended.length === 0) {
      return;
    }
    drags = [];
    for (const drag of ended) {
      drag.end(event, apply);
    }
    if (captured?.hasPointerCapture(pointerId)) {
      captured.releasePointerCapture(pointerId);
    }
    captured = undefined;
    stopClick = moved;
  }

  function start(event: PointerEvent) {
    stopClick = false;
    const target = event.currentTarget as HTMLElement;
    const found = getHandlesAtPoint(own, target, event.clientX, event.clientY);
    // A second pointer on a handle that has a press gives no drag, so it does not change that press.
    if (!own.drag.start(event)) {
      return false;
    }
    const started = [own.drag];
    for (const drag of found) {
      if (drag !== own.drag && drag.start(event)) {
        started.push(drag);
      }
    }
    if (started.length > 1) {
      for (const drag of started) {
        drag.crossing.value = true;
      }
    }
    drags = started;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
    captured = target;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that a script made has no capture. The press goes on with the events of the element.
    }
    return true;
  }

  function move(event: PointerEvent) {
    if (drags.length === 0) {
      // The press of another pointer can drag this handle. That press writes `crossing` until it
      // ends, so a second pointer on the handle does not change it.
      if (own.drag.dragging.value) {
        return;
      }
      // The hover: with no button down, the handle shows whether a press here crosses another one.
      own.drag.crossing.value =
        event.buttons === 0 &&
        getHandlesAtPoint(own, event.currentTarget as HTMLElement, event.clientX, event.clientY)
          .length > 1;
      return;
    }
    if (event.pointerId !== pointerId) {
      return;
    }
    // A release that the page did not send leaves no button down.
    if (event.buttons === 0) {
      finish(event, true);
      return;
    }
    moved ||= event.clientX !== startX || event.clientY !== startY;
    for (const drag of drags) {
      drag.move(event);
    }
    if (drags.every((drag) => !drag.dragging.value)) {
      finish(event, false);
    }
  }

  function endWith(apply: boolean) {
    return (event: PointerEvent) => {
      if (event.pointerId === pointerId) {
        finish(event, apply);
      }
    };
  }

  return {
    listeners: {
      onPointerdown: start,
      onPointermove: move,
      onPointerup: endWith(true),
      // The capture goes away with `pointerup`, so `lostpointercapture` after a release finds no
      // press. One before it means that the pointer is not in the press any more.
      onPointercancel: endWith(false),
      onLostpointercapture: endWith(false),
      onPointerleave() {
        if (drags.length === 0 && !own.drag.dragging.value) {
          own.drag.crossing.value = false;
        }
      },
      // WebKit selects the text between the nearest selectable position and the pointer when a drag
      // starts on an element with `user-select: none`. Preventing the default of `mousedown` stops
      // the selection, and it also stops the focus that the press gives.
      onMousedown(event) {
        if (drags.length > 0) {
          event.preventDefault();
        }
      },
      onClickCapture(event) {
        if (!stopClick) {
          return;
        }
        stopClick = false;
        // A click that a script or an assistive technology makes with no press has no detail. No
        // click follows a touch drag in Chromium, so the flag can still be set at such a click.
        if (event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    },
    start,
    end: () => {
      finish(undefined, false);
    },
  };
}
