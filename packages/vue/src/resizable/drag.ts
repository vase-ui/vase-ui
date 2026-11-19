import { computed, onScopeDispose, shallowReactive, shallowRef, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { adjustLayout, areLayoutsEqual, hasSamePanels, snapDelta, type Layout } from './layout';
import type { ResizableRootForParts } from './root';
import type { ResizableLayout } from './types';

interface Drag {
  readonly root: ResizableRootForParts;
  canMove(): boolean;
  /** Joins the drag to the press. It returns `false` when the drag cannot start. */
  start(event: PointerEvent, press: Set<Drag>): boolean;
  move(event: PointerEvent): void;
  end(event: PointerEvent | undefined, apply: boolean): void;
}

// The drag of each handle element. A press at a crossing finds the handles of other roots here.
const drags = new WeakMap<Element, Drag>();

function dragOf(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const drag = drags.get(node);
    if (drag) return drag;
  }
  return undefined;
}

/**
 * The drags of other roots at the point. The browser lists the elements at the point from the top,
 * and an element that is not in a handle covers each handle under it. A handle that cannot move
 * does not count. The point crosses nothing with no handle of the other orientation.
 */
function crossedDrags(own: Drag, element: Element, x: number, y: number) {
  const found = new Set<Drag>();
  for (const at of element.ownerDocument.elementsFromPoint(x, y)) {
    const drag = dragOf(at);
    if (!drag) break;
    if (drag.root !== own.root && drag.canMove()) found.add(drag);
  }
  return [...found].some((drag) => drag.root.orientation !== own.root.orientation)
    ? [...found]
    : [];
}

/** The press of a handle, its drag, and the drags of the handles of other roots that it crosses. */
export function useDrag(options: {
  root: ResizableRootForParts;
  element: () => HTMLElement | null;
  /** The index in `panels` of the panel before the handle, or -1. */
  pivot: () => number;
  canMove: () => boolean;
}) {
  const { root } = options;
  // The drags of the press that this handle is in.
  const group = shallowRef<Set<Drag>>();
  // A pointer with no button is at a crossing of this handle.
  const hovering = shallowRef(false);
  const dragging = computed(() => group.value !== undefined);
  let horizontal = true;
  let rtl = false;
  let startPointer = 0;
  // A pointer coordinate has the scale of the root.
  let panelSpace = 0;
  let startLayout: Layout = {};
  // The layout of the last change that no listener cancelled. The end of the drag commits it.
  let applied: ResizableLayout | undefined;
  let lastEvent: PointerEvent | undefined;

  const drag: Drag = {
    root,
    canMove: options.canMove,
    start(event, press) {
      const measurement = options.canMove() ? root.measure() : undefined;
      // A root with no room for its panels has no measurement, and no drag.
      if (!measurement || !root.startDrag()) return false;
      press.add(drag);
      group.value = press;
      horizontal = root.orientation === 'horizontal';
      rtl = horizontal && root.readDirection() === 'rtl';
      startPointer = horizontal ? event.clientX : event.clientY;
      panelSpace = measurement.space * measurement.scale;
      startLayout = root.shown;
      applied = undefined;
      lastEvent = event;
      if (root.resizeMode === 'on-release') root.setPendingLayout(startLayout);
      return true;
    },
    move(event) {
      lastEvent = event;
      const pivot = options.pivot();
      // A panel that mounted or unmounted since the start makes the start layout unfit for a move.
      if (pivot < 0 || !hasSamePanels(startLayout, root.shown)) {
        drag.end(event, false);
        return;
      }
      const distance = (horizontal ? event.clientX : event.clientY) - startPointer;
      const delta = ((rtl ? -distance : distance) / panelSpace) * 100;
      const { constraints } = root;
      const next = adjustLayout(
        constraints,
        startLayout,
        pivot,
        snapDelta(constraints, startLayout, pivot, delta, root.dragStep),
        { push: root.pushPanels },
      );
      if (root.pendingLayout) {
        if (!areLayoutsEqual(next, root.pendingLayout)) root.setPendingLayout(next);
      } else if (!areLayoutsEqual(next, root.shown)) {
        applied = root.changeLayout(next, createChangeEventDetails('drag', event)) ?? applied;
      }
    },
    end(event, apply) {
      hovering.value = false;
      // A drag that runs has the event of its press at the least.
      const endEvent = event ?? lastEvent;
      if (!group.value || !endEvent) return;
      group.value.delete(drag);
      group.value = undefined;
      const pending = root.pendingLayout;
      lastEvent = undefined;
      root.endDrag();
      const shown = root.shown;
      // In the mode `'on-release'` the drag has written nothing yet.
      const release =
        apply && pending && hasSamePanels(pending, shown) && !areLayoutsEqual(pending, shown)
          ? pending
          : undefined;
      const layout = release
        ? root.changeLayout(release, createChangeEventDetails('drag', endEvent))
        : applied;
      applied = undefined;
      if (layout) root.commitLayout(layout, 'drag', endEvent);
    },
  };

  // The drags of the press of this handle.
  let press: Set<Drag> | undefined;
  let pointerId = 0;
  let captured: HTMLElement | undefined;
  let startX = 0;
  let startY = 0;
  let moved = false;
  // The next click follows a press in which the pointer moved. The next press clears it.
  let stopClick = false;

  function finish(event: PointerEvent | undefined, apply: boolean) {
    const ended = press;
    if (!ended) return;
    press = undefined;
    for (const each of ended) each.end(event, apply);
    captured = undefined;
    stopClick = moved;
  }

  function endPress() {
    finish(undefined, false);
    // The press of a handle of another root can hold this drag.
    drag.end(undefined, false);
  }

  function endWith(apply: boolean) {
    return (event: PointerEvent) => {
      if (event.pointerId === pointerId) finish(event, apply);
    };
  }

  const listeners = {
    onPointerdown(event: PointerEvent) {
      stopClick = false;
      if (press || event.button !== 0) return;
      const element = event.currentTarget as HTMLElement;
      const started = shallowReactive(new Set<Drag>());
      if (!drag.start(event, started)) return;
      for (const other of crossedDrags(drag, element, event.clientX, event.clientY)) {
        other.start(event, started);
      }
      press = started;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      captured = element;
      element.setPointerCapture(event.pointerId);
      // The `mousedown` of the press does not focus the handle. Here, no browser shows a focus
      // ring unless a key moved the focus before.
      element.focus({ preventScroll: true });
    },
    onPointermove(event: PointerEvent) {
      if (!press) {
        if (!dragging.value) {
          hovering.value =
            event.buttons === 0 &&
            crossedDrags(drag, event.currentTarget as Element, event.clientX, event.clientY)
              .length > 0;
        }
        return;
      }
      if (event.pointerId !== pointerId) return;
      // Firefox sends no `pointerup` for a release outside the view.
      if (event.buttons === 0) {
        finish(event, true);
        return;
      }
      moved ||= event.clientX !== startX || event.clientY !== startY;
      for (const each of press) each.move(event);
    },
    onPointerup: endWith(true),
    // `pointerup` ends the capture, so a `lostpointercapture` before it ends the press.
    onPointercancel: endWith(false),
    onLostpointercapture: endWith(false),
    onPointerleave() {
      hovering.value = false;
    },
    // WebKit selects text from a press that moves, and a prevented `mousedown` stops it.
    onMousedown(event: MouseEvent) {
      if (press) event.preventDefault();
    },
    onClickCapture(event: MouseEvent) {
      if (!stopClick) return;
      stopClick = false;
      // A click of `element.click()` has the detail 0.
      if (event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };

  watch(
    options.element,
    (element, _, onCleanup) => {
      // The browser sends no `lostpointercapture` to a capture element that goes.
      if (captured && captured !== element) finish(undefined, false);
      if (!element) return;
      drags.set(element, drag);
      onCleanup(() => drags.delete(element));
    },
    { immediate: true, flush: 'sync' },
  );
  watch(options.canMove, (canMove) => {
    if (!canMove) endPress();
  });
  onScopeDispose(endPress);

  const previewOffset = computed(() => {
    const pivot = options.pivot();
    const { pendingLayout, measurement, shown } = root;
    if (!pendingLayout || !measurement || pivot < 0) return undefined;
    // The panels before the handle grow by this sum, and the handle moves by the same size.
    let percent = 0;
    for (const panel of root.constraints.slice(0, pivot + 1)) {
      percent += (pendingLayout[panel.id] ?? 0) - (shown[panel.id] ?? 0);
    }
    const reversed = root.orientation === 'horizontal' && root.direction === 'rtl';
    const pixels =
      Math.round((((reversed ? -percent : percent) * measurement.space) / 100) * 1000) / 1000;
    return dragging.value || pixels !== 0 ? `${pixels}px` : undefined;
  });

  return {
    dragging,
    crossing: computed(() => (group.value ? group.value.size > 1 : hovering.value)),
    previewOffset,
    listeners,
  };
}
