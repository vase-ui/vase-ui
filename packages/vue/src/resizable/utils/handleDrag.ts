import { shallowRef } from 'vue';
import type { Ref } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ResizableRootContext } from '../root/ResizableRootContext';
import { adjustLayout, areLayoutsEqual, hasSamePanels, snapDelta } from './layout';
import type { Layout } from './layout';

interface HandleDragOptions {
  /**
   * The index in `panels` of the panel before the boundary, or -1 when the boundary has no panel
   * on one side.
   */
  pivot: () => number;
  disabled: () => boolean;
}

export interface HandleDrag {
  dragging: Readonly<Ref<boolean>>;
  /**
   * Whether a press drags this boundary and a boundary of another root together. The press writes
   * it.
   */
  crossing: Ref<boolean>;
  disabled: () => boolean;
  /**
   * Starts a drag with the `pointerdown` event. It returns `false` when no drag starts.
   */
  start: (event: PointerEvent) => boolean;
  move: (event: PointerEvent) => void;
  /**
   * Ends the drag that runs. The call changes nothing when no drag runs. The event is `undefined`
   * for a change of the lifecycle. `apply` is `true` for the release of the pointer.
   * In a root with `'on-release'`, only `apply` gives the layout of the drag to the root. In a
   * `'live'` root, each move is written already, and each end commits the last layout that no
   * listener canceled.
   */
  end: (event: PointerEvent | undefined, apply: boolean) => void;
}

/**
 * The drag of one boundary of two panels, in one root. A move computes the layout from the layout
 * at the start, so a drag that goes out and back gives the start layout. The pointer session, with
 * its capture and its click, is in `createHandlePress`.
 */
export function createHandleDrag(
  root: ResizableRootContext,
  options: HandleDragOptions,
): HandleDrag {
  const dragging = shallowRef(false);
  const crossing = shallowRef(false);
  let horizontal = true;
  let rtl = false;
  let startPointer = 0;
  // The room of the panels on the screen, in pixels of the screen: the pointer has such pixels.
  let panelSpace = 0;
  let startLayout: Layout = {};
  // The layout that the release gives. A drag in the mode `'on-release'` has it from its start.
  let pending: Layout | undefined;
  // The layout of the last change that no listener canceled. The release commits it.
  let applied: Layout | undefined;
  // A drag that a lifecycle change ends commits with the last pointer event of the drag.
  let lastEvent: PointerEvent | undefined;

  function start(event: PointerEvent) {
    const pivot = options.pivot();
    if (event.button !== 0 || event.defaultPrevented || options.disabled() || pivot < 0) {
      return false;
    }
    // A root with no room for its panels has no measurement, and no drag.
    const measurement = root.measure();
    if (measurement === undefined || !root.startDragging()) {
      return false;
    }
    dragging.value = true;
    horizontal = root.orientation.value === 'horizontal';
    rtl = horizontal && root.direction.value === 'rtl';
    startPointer = horizontal ? event.clientX : event.clientY;
    panelSpace = measurement.space * measurement.scale;
    startLayout = root.shown.value;
    applied = undefined;
    lastEvent = event;
    pending = root.resizeMode.value === 'on-release' ? startLayout : undefined;
    if (pending) {
      root.setPendingLayout(pending);
    }
    return true;
  }

  function end(event: PointerEvent | undefined, apply: boolean) {
    if (!dragging.value) {
      return;
    }
    dragging.value = false;
    crossing.value = false;
    root.stopDragging();
    const endEvent = event ?? lastEvent;
    const release =
      apply && pending && !areLayoutsEqual(pending, root.shown.value) ? pending : undefined;
    // In the mode `'on-release'` the drag has written nothing yet, so the release writes the layout.
    const layout = release
      ? root.changeLayout(release, createChangeEventDetails(REASONS.drag, endEvent))
      : applied;
    pending = undefined;
    applied = undefined;
    if (layout) {
      root.commitLayout(layout, REASONS.drag, endEvent);
    }
  }

  function move(event: PointerEvent) {
    if (!dragging.value) {
      return;
    }
    lastEvent = event;
    const pivot = options.pivot();
    const shown = root.shown.value;
    // The start layout is about the panels at the start. A panel that mounted or unmounted since
    // then makes the layout and the boundary unfit for the move.
    if (pivot < 0 || !hasSamePanels(startLayout, shown)) {
      end(event, false);
      return;
    }
    const distance = (horizontal ? event.clientX : event.clientY) - startPointer;
    const delta = ((rtl ? -distance : distance) / panelSpace) * 100;
    const next = adjustLayout(
      root.constraints.value,
      startLayout,
      pivot,
      snapDelta(root.constraints.value, startLayout, pivot, delta, root.dragStep.value),
      { push: root.pushPanels.value },
    );
    if (pending) {
      if (!areLayoutsEqual(next, pending)) {
        pending = next;
        root.setPendingLayout(next);
      }
      return;
    }
    if (areLayoutsEqual(next, shown)) {
      return;
    }
    applied = root.changeLayout(next, createChangeEventDetails(REASONS.drag, event)) ?? applied;
  }

  return { dragging, crossing, disabled: options.disabled, start, move, end };
}
