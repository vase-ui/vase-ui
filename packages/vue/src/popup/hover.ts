import { onScopeDispose, watch, type Ref } from 'vue';
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

/**
 * Opens a popup when a mouse rests on its trigger, and closes it when the pointer leaves the
 * trigger and the popup. The pointer can cross the space between them in the triangle from the
 * point where it left the trigger to the near edge of the popup. A popup that no hover and no press
 * opened closes only when the pointer leaves its trigger.
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
  },
) {
  const openTimer = useTimeout();
  const closeTimer = useTimeout();
  const restTimer = useTimeout();
  let openedAt = -Infinity;

  // The pointer closes a popup that is open for this trigger, unless a press opened or kept it.
  const closedBy = () => {
    const current = root();
    const trigger = options.trigger.value;
    if (
      !options.enabled() ||
      !trigger ||
      !current?.open ||
      current.reason === 'trigger-press' ||
      current.activeTrigger !== trigger
    ) {
      return null;
    }
    return current.reason === 'trigger-hover' ? 'hover' : 'trigger';
  };

  watch(
    () => root()?.closeRequests,
    () => openTimer.clear(),
  );

  function open(event: PointerEvent) {
    const element = options.trigger.value;
    const current = root();
    // A toolbar item keeps the focus with `aria-disabled`, and a fieldset can disable the trigger
    // in the delay.
    if (!element || !current || !options.enabled()) return;
    if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return;
    current.request(true, 'trigger-hover', event, element);
    if (current.open && current.reason === 'trigger-hover') {
      openedAt = ownerWindow(element).performance.now();
    }
  }

  function startOpen(event: PointerEvent) {
    openTimer.start(options.delay(), () => open(event));
  }

  // A touch that rests for the delay would open the popup, and the click at its end would close it.
  // A popup that is open for this trigger keeps the time of its open, for the press after it.
  function onPointerenter(event: PointerEvent) {
    const current = root();
    if (
      !options.enabled() ||
      event.pointerType === 'touch' ||
      (current?.open && current.activeTrigger === options.trigger.value)
    ) {
      return;
    }
    if (current && opensAtOnce(current)) open(event);
    else startOpen(event);
  }

  // The delay starts again while the pointer moves: the pointer rests on the trigger.
  function onPointermove(event: PointerEvent) {
    if (openTimer.isStarted()) startOpen(event);
  }

  function onPointerleave() {
    openTimer.clear();
  }

  // While the popup is open for this trigger, one listener of the document follows the pointer.
  // Vapor sets the ref of the trigger before it inserts the element, so the watcher reads the
  // document of the trigger after the render.
  let from: Point | null = null;
  let over: 'trigger' | 'popup' | 'outside' = 'trigger';
  watch(
    closedBy,
    (by, _, onCleanup) => {
      if (!by) return;
      const doc = ownerDocument(options.trigger.value);
      const byHover = by === 'hover';
      // The pointer of a popup that no hover opened can be anywhere.
      over = byHover ? 'trigger' : 'outside';
      from = null;
      onCleanup(
        mergeCleanups(
          addEventListener(doc, 'pointermove', (event) => follow(event, byHover), true),
          byHover && addEventListener(doc.documentElement, 'pointerleave', close),
          closeTimer.clear,
          restTimer.clear,
        ),
      );
    },
    { flush: 'post' },
  );

  function follow(event: PointerEvent, byHover: boolean) {
    const trigger = options.trigger.value;
    const target = event.target as Element;
    const point = { x: event.clientX, y: event.clientY };
    restTimer.clear();
    if (trigger?.contains(target)) {
      over = 'trigger';
      closeTimer.clear();
      return;
    }
    if (options.inside(target)) {
      over = 'popup';
      closeTimer.clear();
      if (!byHover) from = null;
      return;
    }
    if (over === 'trigger') from = point;
    over = 'outside';
    if (!byHover && !from) return;
    const popup = root()?.popup;
    if (from && trigger && popup && inTriangle(point, from, trigger, popup)) {
      restTimer.start(REST_IN_TRIANGLE, close);
      return;
    }
    from = null;
    close();
  }

  function close() {
    if (closeTimer.isStarted()) return;
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

/**
 * A hover opens the popup with no delay while the popup is open for another trigger, and while it
 * leaves after a hover close. A kept popup leaves while an animation of its element runs. An
 * animation that ended and fills forwards does not run (test/measurements/preview-card.test.ts).
 */
function opensAtOnce(root: PopupRoot) {
  if (root.open) return true;
  if (root.reason !== 'trigger-hover') return false;
  return (
    root.leaving ||
    !!root.popup?.getAnimations().some((animation) => animation.playState === 'running')
  );
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
