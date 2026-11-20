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
    /**
     * The pointer can cross the space to the popup in the triangle. A popup that takes no hover has
     * `pointer-events: none` on its positioner.
     * @default () => true
     */
    hoverablePopup?: () => boolean;
    /** A hover also opens on a trigger element that is `:disabled` or has `aria-disabled`. */
    openOnDisabled?: boolean;
    /**
     * The pointer of a `pointerover` is on a trigger in this trigger. The hover then waits for no
     * open, and a popup that the hover opened for this trigger closes at once.
     */
    inner?: (event: PointerEvent) => boolean;
  },
) {
  const openTimer = useTimeout();
  const closeTimer = useTimeout();
  const restTimer = useTimeout();
  let openedAt = -Infinity;
  /** The pointer is on a trigger in this trigger. */
  let onInner = false;

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

  function openAt(event: PointerEvent) {
    const element = options.trigger.value;
    const current = root();
    // A toolbar item keeps the focus with `aria-disabled`, and a fieldset can disable the trigger
    // in the delay.
    if (!element || !current || !options.enabled()) return;
    if (
      !options.openOnDisabled &&
      (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true')
    ) {
      return;
    }
    current.request(true, 'trigger-hover', event, element);
    if (current.open && current.reason === 'trigger-hover') {
      openedAt = ownerWindow(element).performance.now();
    }
  }

  // A popup that is open for another trigger moves at once, and a popup that leaves after a hover
  // close opens again at once.
  function startOpen(event: PointerEvent, current: PopupRoot) {
    if (current.open || (current.leaving && current.reason === 'trigger-hover')) {
      openTimer.clear();
      openAt(event);
      return;
    }
    openTimer.start(options.delay(), () => openAt(event));
  }

  // A touch that rests for the delay would open the popup, and the click at its end would close it.
  // A popup that is open for this trigger keeps the time of its open, for the press after it. A
  // popup that code opened with no active trigger stays where it is.
  function onPointerenter(event: PointerEvent) {
    const current = root();
    if (
      !current ||
      !options.enabled() ||
      event.pointerType === 'touch' ||
      onInner ||
      (current.open &&
        (current.activeTriggerId === null || current.activeTrigger === options.trigger.value))
    ) {
      return;
    }
    startOpen(event, current);
  }

  // The delay starts again while the pointer moves: the pointer rests on the trigger.
  function onPointermove(event: PointerEvent) {
    const current = root();
    if (current && openTimer.isStarted() && !onInner) startOpen(event, current);
  }

  function onPointerleave() {
    openTimer.clear();
    onInner = false;
  }

  // A trigger in this trigger gets the `pointerover` first, and this trigger gets the same event.
  // The pointer that comes back to the rest of this trigger sends no `pointerenter`.
  function onPointerover(event: PointerEvent) {
    const wasInner = onInner;
    onInner = !!options.inner?.(event);
    if (onInner) {
      openTimer.clear();
      if (hoverOpen()) root()?.request(false, 'trigger-hover', event);
    } else if (wasInner) {
      onPointerenter(event);
    }
  }

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
        ),
      );
    },
    { flush: 'sync' },
  );

  function follow(event: PointerEvent) {
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
      return;
    }
    if (over === 'trigger') from = point;
    over = 'outside';
    const popup = root()?.popup;
    const crosses = options.hoverablePopup?.() ?? true;
    if (crosses && from && trigger && popup && inTriangle(point, from, trigger, popup)) {
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
    listeners: { onPointerenter, onPointermove, onPointerleave, onPointerover },
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
