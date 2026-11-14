import { shallowRef } from 'vue';
import type { Ref } from 'vue';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ResizableRootContext } from '../root/ResizableRootContext';
import { adjustLayout, areLayoutsEqual, hasSamePanels } from './layout';
import type { Layout } from './layout';

interface HandleDragOptions {
  /**
   * The index in `panels` of the panel before the handle, or -1 when the handle has no panel on
   * one side.
   */
  pivot: () => number;
  disabled: () => boolean;
  /**
   * The element that holds the pointer capture.
   */
  element: () => HTMLElement | null;
}

interface HandleDrag {
  dragging: Readonly<Ref<boolean>>;
  /**
   * Starts a drag with the `pointerdown` event. It returns `false` when no drag starts.
   */
  start: (event: PointerEvent) => boolean;
  move: (event: PointerEvent) => void;
  /**
   * Ends the drag that runs. The call changes nothing when no drag runs.
   */
  end: (event?: PointerEvent) => void;
}

/**
 * The drag of a handle. A move computes the layout from the layout at the start, so a drag that
 * goes out and back gives the start layout.
 */
export function createHandleDrag(
  root: ResizableRootContext,
  options: HandleDragOptions,
): HandleDrag {
  const dragging = shallowRef(false);
  let pointerId = 0;
  let horizontal = true;
  let rtl = false;
  let startPointer = 0;
  let panelSpace = 0;
  let startLayout: Layout = {};
  // The layout of the last change that no listener canceled. The release commits it.
  let applied: Layout | undefined;

  function start(event: PointerEvent) {
    const pivot = options.pivot();
    if (event.button !== 0 || event.defaultPrevented || options.disabled() || pivot < 0) {
      return false;
    }
    const space = root.getPanelSpace();
    if (space <= 0 || !root.startDragging()) {
      return false;
    }
    dragging.value = true;
    pointerId = event.pointerId;
    horizontal = root.orientation.value === 'horizontal';
    rtl = horizontal && root.direction.value === 'rtl';
    startPointer = horizontal ? event.clientX : event.clientY;
    panelSpace = space;
    startLayout = root.shown.value;
    applied = undefined;
    try {
      options.element()?.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that a script made has no capture. The drag goes on with the events of the element.
    }
    return true;
  }

  function end(event?: PointerEvent) {
    // A lifecycle change gives no event. The event of another pointer does not end the drag.
    if (!dragging.value || (event && event.pointerId !== pointerId)) {
      return;
    }
    dragging.value = false;
    const element = options.element();
    if (element?.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    root.stopDragging();
    if (applied) {
      const layout = applied;
      applied = undefined;
      root.commitLayout(layout, createGenericEventDetails(REASONS.drag, event));
    }
  }

  function move(event: PointerEvent) {
    if (!dragging.value || event.pointerId !== pointerId) {
      return;
    }
    // A release that the page did not send leaves no button down.
    if (event.buttons === 0) {
      end(event);
      return;
    }
    const pivot = options.pivot();
    const shown = root.shown.value;
    // The start layout is about the panels at the start. A panel that mounted or unmounted since
    // then makes the layout and the handle unfit for the move.
    if (pivot < 0 || !hasSamePanels(startLayout, shown)) {
      end(event);
      return;
    }
    const distance = (horizontal ? event.clientX : event.clientY) - startPointer;
    const delta = ((rtl ? -distance : distance) / panelSpace) * 100;
    const next = adjustLayout(root.constraints.value, startLayout, pivot, delta);
    if (areLayoutsEqual(next, shown)) {
      return;
    }
    applied = root.changeLayout(next, createChangeEventDetails(REASONS.drag, event)) ?? applied;
  }

  return { dragging, start, move, end };
}
