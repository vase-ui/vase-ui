import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { useTimeout } from '../common/useTimeout';
import type { PopupRoot } from './root';

type Point = { x: number; y: number };

// A press in this time after a hover open keeps the popup open, as after a press.
const PATIENT_PRESS = 500;
// The pointer that stops in the triangle to the popup for this time closes the popup.
const REST_IN_TRIANGLE = 40;

// For each root, the pointer moves in the triangle to its popup. No other trigger of the root opens
// by hover in this time.
const crossings = new WeakMap<PopupRoot, ShallowRef<boolean>>();

function crossingOf(root: PopupRoot) {
  let crossing = crossings.get(root);
  if (!crossing) {
    crossing = shallowRef(false);
    crossings.set(root, crossing);
  }
  return crossing;
}

/**
 * Opens a popup when a mouse rests on its trigger, and closes it when the pointer leaves the
 * trigger and the popup. The pointer can cross the space between them in the triangle from the
 * point where it left the trigger to the near edge of the popup.
 */
export function usePopupHover(
  root: () => PopupRoot | null,
  options: {
    trigger: Readonly<Ref<HTMLElement | null>>;
    enabled: () => boolean;
    delay: () => number;
    closeDelay: () => number;
    /** The element is in the popup or in a popup above it. */
    inside: (element: Element) => boolean;
    /** A pointer that leaves closes the popup. */
    closes?: () => boolean;
  },
) {
  const openTimer = useTimeout();
  const closeTimer = useTimeout();
  const restTimer = useTimeout();
  let openedAt = -Infinity;
  // The `pointerenter` of the pointer that is on the trigger.
  let entered: PointerEvent | null = null;

  const hoverOpen = () => {
    const current = root();
    return (
      !!current?.open &&
      current.reason === 'trigger-hover' &&
      current.activeTrigger === options.trigger.value
    );
  };

  watch(
    () => root()?.closeRequests,
    () => openTimer.clear(),
  );

  function startOpen(event: PointerEvent) {
    openTimer.start(options.delay(), () => {
      const element = options.trigger.value;
      const current = root();
      // A toolbar item keeps the focus with `aria-disabled`, and a fieldset can disable the
      // trigger in the delay.
      if (!element || !current || !options.enabled()) return;
      if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return;
      // The watcher of the crossing opens it when the pointer leaves the triangle on the trigger.
      if (crossingOf(current).value && current.activeTrigger !== element) return;
      current.request(true, 'trigger-hover', event, element);
      if (current.open && current.reason === 'trigger-hover') {
        openedAt = ownerWindow(element).performance.now();
      }
    });
  }

  // A touch that rests for the delay would open the popup, and the click at its end would close it.
  // A popup that is open for this trigger keeps the time of its open, for the press after it.
  function onPointerenter(event: PointerEvent) {
    const current = root();
    entered = event;
    if (
      !options.enabled() ||
      event.pointerType === 'touch' ||
      (current?.open && current.activeTrigger === options.trigger.value)
    ) {
      return;
    }
    startOpen(event);
  }

  // The delay starts again while the pointer moves: the pointer rests on the trigger.
  function onPointermove(event: PointerEvent) {
    if (openTimer.isStarted()) startOpen(event);
  }

  function onPointerleave() {
    entered = null;
    openTimer.clear();
  }

  watch(
    () => {
      const current = root();
      return !!current && crossingOf(current).value;
    },
    (crossing) => {
      if (!crossing && entered) onPointerenter(entered);
    },
    { flush: 'sync' },
  );

  // While the hover keeps the popup open, one listener of the document follows the pointer.
  let from: Point | null = null;
  let over: 'trigger' | 'popup' | 'outside' = 'trigger';
  watch(
    hoverOpen,
    (open, _, onCleanup) => {
      if (!open) return;
      const doc = ownerDocument(options.trigger.value);
      over = 'trigger';
      from = null;
      onCleanup(
        mergeCleanups(
          addEventListener(doc, 'pointermove', follow, true),
          addEventListener(doc.documentElement, 'pointerleave', close),
          closeTimer.clear,
          restTimer.clear,
          () => setCrossing(false),
        ),
      );
    },
    { flush: 'sync' },
  );

  function setCrossing(crossing: boolean) {
    const current = root();
    if (current) crossingOf(current).value = crossing;
  }

  function follow(event: PointerEvent) {
    const trigger = options.trigger.value;
    const target = event.target as Element;
    const point = { x: event.clientX, y: event.clientY };
    restTimer.clear();
    if (trigger?.contains(target)) {
      over = 'trigger';
      setCrossing(false);
      closeTimer.clear();
      return;
    }
    if (options.inside(target)) {
      over = 'popup';
      setCrossing(false);
      closeTimer.clear();
      return;
    }
    if (over === 'trigger') from = point;
    over = 'outside';
    const popup = root()?.popup;
    if (from && trigger && popup && inTriangle(point, from, trigger, popup)) {
      setCrossing(true);
      restTimer.start(REST_IN_TRIANGLE, () => {
        setCrossing(false);
        close();
      });
      return;
    }
    from = null;
    // Another trigger under the pointer starts its open before this close.
    setCrossing(false);
    close();
  }

  function close() {
    if (closeTimer.isStarted() || options.closes?.() === false) return;
    // The timer stops when a press keeps the popup open or the popup moves to another trigger.
    closeTimer.start(options.closeDelay(), () =>
      root()?.request(false, 'trigger-hover', new Event('vase-ui')),
    );
  }

  onScopeDispose(() => {
    openTimer.clear();
    closeTimer.clear();
    restTimer.clear();
  });

  return {
    listeners: { onPointerenter, onPointermove, onPointerleave },
    /** A press closes the open popup: it came more than 500 ms after the hover open. */
    closesAtPress(event: Event) {
      return !(root()?.reason === 'trigger-hover' && event.timeStamp - openedAt < PATIENT_PRESS);
    },
  };
}

// The triangle from the point where the pointer left the trigger to the near edge of the popup.
function inTriangle(point: Point, from: Point, trigger: Element, popup: Element) {
  const anchor = trigger.getBoundingClientRect();
  const box = popup.getBoundingClientRect();
  let edge: [Point, Point];
  if (box.top >= anchor.bottom) {
    edge = [
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
    ];
  } else if (box.bottom <= anchor.top) {
    edge = [
      { x: box.left, y: box.bottom },
      { x: box.right, y: box.bottom },
    ];
  } else if (box.left >= anchor.right) {
    edge = [
      { x: box.left, y: box.top },
      { x: box.left, y: box.bottom },
    ];
  } else if (box.right <= anchor.left) {
    edge = [
      { x: box.right, y: box.top },
      { x: box.right, y: box.bottom },
    ];
  } else {
    return false;
  }
  const [a, b] = edge;
  const side = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(from, a, point);
  const d2 = side(a, b, point);
  const d3 = side(b, from, point);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
