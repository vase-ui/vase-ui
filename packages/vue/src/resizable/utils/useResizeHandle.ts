import { computed, onScopeDispose, shallowRef, toValue, watch, watchPostEffect } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import type { ResizableRootContext } from '../root/ResizableRootContext';
import { adjustLayout, areLayoutsEqual, getHandleLimits, hasSamePanels, snapDelta } from './layout';
import type { Layout } from './layout';

export interface HandleDrag {
  dragging: Readonly<Ref<boolean>>;
  crossing: Ref<boolean>;
  disabled: () => boolean;
  start: (event: PointerEvent) => boolean;
  move: (event: PointerEvent) => void;
  end: (event: PointerEvent | undefined, apply: boolean) => void;
}

interface ResizeHandleOptions {
  pivot: MaybeRefOrGetter<number>;
  disabled: MaybeRefOrGetter<boolean>;
  elements: MaybeRefOrGetter<readonly (HTMLElement | null)[]>;
  hitArea?: MaybeRefOrGetter<HTMLElement | null>;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box in which a press joins the drag of a handle or an edge of another root: the box of the
 * handle element or of the edge node, grown by half of the hit area size of its root on each side.
 * A press that is that near to two handles is at their crossing.
 */
export function getJoinBox(box: Box, size: number): Box {
  const half = size / 2;
  return {
    left: box.left - half,
    top: box.top - half,
    right: box.right + half,
    bottom: box.bottom + half,
  };
}

export function isInBox(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * The point inside `box` that is nearest to the point (x, y).
 */
export function getNearestPoint(box: Box, x: number, y: number): { x: number; y: number } {
  // A hit test does not find an element at its right border or at its bottom border.
  const insetX = Math.min((box.right - box.left) / 2, 0.5);
  const insetY = Math.min((box.bottom - box.top) / 2, 0.5);
  return {
    x: Math.min(Math.max(x, box.left), box.right - insetX),
    y: Math.min(Math.max(y, box.top), box.bottom - insetY),
  };
}

interface RegisteredHandle {
  /**
   * The handle element or the edge node: the element that has the pointer listeners.
   */
  element: Element;
  /**
   * The drag that a press on the element starts. The two nodes of an edge share one drag.
   */
  drag: HandleDrag;
  /**
   * The orientation of the root of the handle.
   */
  orientation: () => Orientation;
  /**
   * The hit area size of the root of the handle, in pixels.
   */
  hitAreaSize: () => number;
}

/**
 * The handle or the edge that a press is on: its drag, and the orientation of its root.
 */
interface PressedHandle {
  drag: HandleDrag;
  orientation: () => Orientation;
}

type ElementsFromPointRoot = Node & Partial<Pick<Document, 'elementsFromPoint'>>;

const handles = new Set<RegisteredHandle>();
// The element of each handle, its hit area node and each edge node. A press on one of them is a
// press on a handle, so such a node does not cover another handle.
const nodes = new WeakSet<Element>();

/**
 * Adds a handle or an edge node to the registry. It gives the function that removes it.
 */
export function registerHandle(handle: RegisteredHandle, hitArea?: Element | null): () => void {
  handles.add(handle);
  nodes.add(handle.element);
  if (hitArea) {
    nodes.add(hitArea);
  }
  return () => {
    handles.delete(handle);
    nodes.delete(handle.element);
    if (hitArea) {
      nodes.delete(hitArea);
    }
  };
}

function isHandleNode(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (nodes.has(node)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether an element that is not a handle is above `handle` at the point. A dialog over the page
 * covers the handles of the page, and a press in the dialog is then not for them. A node of another
 * handle, such as its hit area, does not cover the handle.
 */
function isCovered(handle: RegisteredHandle, elementsAtPoint: readonly Element[]) {
  for (const element of elementsAtPoint) {
    if (handle.element.contains(element)) {
      return false;
    }
    if (!isHandleNode(element)) {
      return true;
    }
  }
  // A list with no element of the handle means that something hides it, such as an ancestor that
  // clips its content.
  return true;
}

/**
 * The drags that a press at (x, y) on `own` starts: the drag of `own` first, then the drag of each
 * handle and each edge of another root that the press crosses. Another handle joins when it can
 * move, the point is in its join box, and no other element covers it at its nearest point. With
 * no handle of the other orientation in the result, the press drags only `own`: a crossing has the
 * two axes.
 * @param element The element that has the listener of the press.
 */
export function getHandlesAtPoint(
  own: PressedHandle,
  element: Element,
  x: number,
  y: number,
): HandleDrag[] {
  const root: ElementsFromPointRoot = element.getRootNode();
  if (typeof root.elementsFromPoint !== 'function') {
    return [own.drag];
  }
  const found = new Set<HandleDrag>();
  let crossing = false;
  for (const handle of handles) {
    if (
      handle.drag === own.drag ||
      found.has(handle.drag) ||
      handle.drag.disabled() ||
      handle.element.getRootNode() !== root
    ) {
      continue;
    }
    const rect = handle.element.getBoundingClientRect();
    if (!isInBox(getJoinBox(rect, handle.hitAreaSize()), x, y)) {
      continue;
    }
    const near = getNearestPoint(rect, x, y);
    if (!isCovered(handle, root.elementsFromPoint(near.x, near.y))) {
      found.add(handle.drag);
      crossing ||= handle.orientation() !== own.orientation();
    }
  }
  return crossing ? [own.drag, ...found] : [own.drag];
}

export function useResizeHandle(root: ResizableRootContext, options: ResizeHandleOptions) {
  const dragging = shallowRef(false);
  const crossing = shallowRef(false);
  let horizontal = true;
  let rtl = false;
  let startPointer = 0;
  // Pointer coordinates include the scale of the root.
  let panelSpace = 0;
  let startLayout: Layout = {};
  // The layout of the last change that no listener canceled. The release commits it.
  let applied: Layout | undefined;
  // A drag that a lifecycle change ends commits with the last pointer event of the drag.
  let lastEvent: PointerEvent | undefined;

  function startDrag(event: PointerEvent) {
    const pivot = toValue(options.pivot);
    if (event.button !== 0 || event.defaultPrevented || toValue(options.disabled) || pivot < 0) {
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
    if (root.resizeMode.value === 'on-release') {
      root.setPendingLayout(startLayout);
    }
    return true;
  }

  function endDrag(event: PointerEvent | undefined, apply: boolean) {
    if (!dragging.value) {
      return;
    }
    dragging.value = false;
    crossing.value = false;
    const pending = root.pendingLayout.value;
    root.stopDragging();
    const endEvent = event ?? lastEvent;
    const shown = root.shown.value;
    const release =
      apply && pending && hasSamePanels(pending, shown) && !areLayoutsEqual(pending, shown)
        ? pending
        : undefined;
    // In the mode `'on-release'` the drag has written nothing yet, so the release writes the layout.
    const layout = release
      ? root.changeLayout(release, createChangeEventDetails(REASONS.drag, endEvent))
      : applied;
    applied = undefined;
    if (layout) {
      root.commitLayout(layout, REASONS.drag, endEvent);
    }
  }

  function moveDrag(event: PointerEvent) {
    if (!dragging.value) {
      return;
    }
    lastEvent = event;
    const pivot = toValue(options.pivot);
    const shown = root.shown.value;
    // The start layout is about the panels at the start. A panel that mounted or unmounted since
    // then makes the layout and the boundary unfit for the move.
    if (pivot < 0 || !hasSamePanels(startLayout, shown)) {
      endDrag(event, false);
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
    const pending = root.pendingLayout.value;
    if (pending) {
      if (!areLayoutsEqual(next, pending)) {
        root.setPendingLayout(next);
      }
      return;
    }
    if (areLayoutsEqual(next, shown)) {
      return;
    }
    applied = root.changeLayout(next, createChangeEventDetails(REASONS.drag, event)) ?? applied;
  }

  const drag: HandleDrag = {
    dragging,
    crossing,
    disabled: () => toValue(options.disabled),
    start: startDrag,
    move: moveDrag,
    end: endDrag,
  };
  const own = { drag, orientation: () => root.orientation.value };

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

  function onPointerdown(event: PointerEvent) {
    stopClick = false;
    const target = event.currentTarget as HTMLElement;
    const found = getHandlesAtPoint(own, target, event.clientX, event.clientY);
    // A second pointer on a handle that has a press gives no drag, so it does not change that press.
    if (!startDrag(event)) {
      return false;
    }
    const started = found.filter((candidate) => candidate === drag || candidate.start(event));
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

  function onPointermove(event: PointerEvent) {
    if (drags.length === 0) {
      // The press of another pointer can drag this handle. That press writes `crossing` until it
      // ends, so a second pointer on the handle does not change it.
      if (dragging.value) {
        return;
      }
      // The hover: with no button down, the handle shows whether a press here crosses another one.
      crossing.value =
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

  const listeners = {
    onPointerdown,
    onPointermove,
    onPointerup: endWith(true),
    // The capture goes away with `pointerup`, so `lostpointercapture` after a release finds no
    // press. One before it means that the pointer is not in the press any more.
    onPointercancel: endWith(false),
    onLostpointercapture: endWith(false),
    onPointerleave() {
      if (drags.length === 0 && !dragging.value) {
        crossing.value = false;
      }
    },
    // WebKit selects the text between the nearest selectable position and the pointer when a drag
    // starts on an element with `user-select: none`. Preventing the default of `mousedown` stops
    // the selection, and it also stops the focus that the press gives.
    onMousedown(event: MouseEvent) {
      if (drags.length > 0) {
        event.preventDefault();
      }
    },
    onClickCapture(event: MouseEvent) {
      if (!stopClick) {
        return;
      }
      stopClick = false;
      // A click with no press, such as the click of `element.click()`, has the detail 0. No click
      // follows a touch drag in Chromium, so the flag can still be set at such a click.
      if (event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };

  function endPress() {
    finish(undefined, false);
    // Another boundary can own the pointer capture for this drag.
    endDrag(undefined, false);
  }

  const { isHeld } = useKeepAliveState();
  watch(
    isHeld,
    (held) => {
      if (held) endPress();
    },
    { flush: 'sync' },
  );
  onScopeDispose(endPress);

  watchPostEffect((onCleanup) => {
    if (isHeld.value) return;
    const elements = toValue(options.elements);
    // A removed capture target sends lostpointercapture to the document.
    if (captured && !elements.includes(captured)) finish(undefined, false);
    const hitArea = toValue(options.hitArea);
    const remove = elements.flatMap((element) =>
      element
        ? [registerHandle({ ...own, element, hitAreaSize: () => root.hitAreaSize.value }, hitArea)]
        : [],
    );
    onCleanup(() => remove.forEach((unregister) => unregister()));
  });

  const reversed = computed(
    () => root.orientation.value === 'horizontal' && root.direction.value === 'rtl',
  );
  const ends = computed(() => {
    const index = toValue(options.pivot);
    if (index < 0 || root.lengthPanels.value.size > 0) return { atMin: false, atMax: false };
    return getHandleLimits(
      root.constraints.value,
      root.shown.value,
      index,
      root.pushPanels.value,
      reversed.value,
    );
  });
  const previewOffset = computed(() => {
    const index = toValue(options.pivot);
    const pending = root.pendingLayout.value;
    const measurement = root.measurement.value;
    if (pending === undefined || measurement === undefined || index < 0) {
      return undefined;
    }
    // The panels before the boundary grow by this sum, and the boundary moves by the same size.
    const shown = root.shown.value;
    let percent = 0;
    for (const panel of root.constraints.value.slice(0, index + 1)) {
      percent += (pending[panel.id] ?? 0) - (shown[panel.id] ?? 0);
    }
    const pixels =
      Math.round((((reversed.value ? -percent : percent) * measurement.space) / 100) * 1000) / 1000;
    return dragging.value || pixels !== 0 ? `${pixels}px` : undefined;
  });

  return { dragging, crossing, ends, previewOffset, isHeld, listeners, endPress };
}
