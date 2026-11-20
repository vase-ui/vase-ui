import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { useTimeout } from '../common/useTimeout';
import { isInPopup, layerOf } from './layer';
import type { PopupRoot } from './root';

type Point = { x: number; y: number };

// A press in this time after a hover open keeps the popup open, as after a press.
const PATIENT_PRESS = 500;
// The pointer that stops in the triangle to the popup for this time closes the popup.
const REST_IN_TRIANGLE = 40;

// For each root, the pointer moves in the triangle to its popup. No other trigger of the root opens
// by hover in this time.
const crossings = new WeakMap<PopupRoot, ShallowRef<boolean>>();

// For each root, the test of the trigger whose popup is open: the point is in the triangle to the
// popup. Another trigger gets its `pointerenter` before the `pointermove` of the same input, so it
// asks with the point of that event.
const approaches = new WeakMap<PopupRoot, (point: Point) => boolean>();

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
    /** A pointer that leaves closes the popup. */
    closes?: () => boolean;
    /**
     * The delay starts at the first `pointermove` that the check accepts, and the open comes at its
     * end, also while the pointer moves.
     */
    startOnMove?: (event: PointerEvent) => boolean;
    /** The caller closes the popup for a pointer on this element outside the triangle. */
    passOn?: (element: Element) => boolean;
    /** After the pointer was in the popup, a pointer that leaves closes nothing. */
    stayAfterEnter?: boolean;
  },
) {
  const openTimer = useTimeout();
  const closeTimer = useTimeout();
  const restTimer = useTimeout();
  let openedAt = -Infinity;
  /** The pointer is on a trigger in this trigger. */
  let onInner = false;
  // The `pointerenter` of the pointer that is on the trigger.
  let entered: PointerEvent | null = null;
  // The last point of the pointer on this trigger, from its own events: a `pointerleave` can come
  // with the point of a new layout.
  let last: Point | null = null;
  // The crossing watcher opens the trigger after the crossing, with no new test of the triangle.
  let afterCrossing = false;

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
    // A pointer that moves to the popup of another trigger in the triangle opens nothing. The
    // watcher of the crossing opens this trigger when the pointer leaves the triangle on it, or
    // rests there.
    if (
      current.activeTrigger !== element &&
      (crossingOf(current).value ||
        (!afterCrossing && approaches.get(current)?.({ x: event.clientX, y: event.clientY })))
    ) {
      return;
    }
    current.request(true, 'trigger-hover', event, element);
    if (current.open && current.reason === 'trigger-hover') {
      openedAt = ownerWindow(element).performance.now();
    }
  }

  function startOpen(event: PointerEvent, current: PopupRoot) {
    if (opensAtOnce(current)) {
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
    entered = event;
    if (!afterCrossing) last = { x: event.clientX, y: event.clientY };
    if (
      options.startOnMove ||
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
    last = { x: event.clientX, y: event.clientY };
    const current = root();
    if (!current) return;
    if (!options.startOnMove) {
      if (openTimer.isStarted()) startOpen(event, current);
      return;
    }
    if (openTimer.isStarted() || !options.enabled() || event.pointerType === 'touch') return;
    if (options.startOnMove(event)) startOpen(event, current);
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
      if (crossing || !entered) return;
      afterCrossing = true;
      onPointerenter(entered);
      afterCrossing = false;
    },
    { flush: 'sync' },
  );

  // A trigger in this trigger gets the `pointerover` first, and this trigger gets the same event.
  // The pointer that comes back to the rest of this trigger sends no `pointerenter`.
  function onPointerover(event: PointerEvent) {
    const wasInner = onInner;
    onInner = !!options.inner?.(event);
    if (onInner) {
      openTimer.clear();
      if (closedBy() === 'hover') root()?.request(false, 'trigger-hover', event);
    } else if (wasInner) {
      onPointerenter(event);
    }
  }

  // While the popup is open for this trigger, one listener of the document follows the pointer.
  // Vapor sets the ref of the trigger before it inserts the element, so the watcher reads the
  // document of the trigger after the render.
  let from: Point | null = null;
  let over: 'trigger' | 'popup' | 'outside' = 'trigger';
  let enteredPopup = false;
  let following = false;
  const inTriangle = shallowRef(false);
  watch(
    closedBy,
    (by, _, onCleanup) => {
      if (!by) return;
      const doc = ownerDocument(options.trigger.value);
      const byHover = by === 'hover';
      // The pointer of a popup that no hover opened can be anywhere.
      over = byHover ? 'trigger' : 'outside';
      from = null;
      enteredPopup = false;
      following = true;
      const current = root();
      if (current) approaches.set(current, approach);
      onCleanup(
        mergeCleanups(
          addEventListener(doc, 'pointermove', (event) => follow(event, byHover), true),
          byHover &&
            addEventListener(doc.documentElement, 'pointerleave', () => {
              if (!enteredPopup || !options.stayAfterEnter) close();
            }),
          closeTimer.clear,
          restTimer.clear,
          () => setCrossing(false),
          () => (inTriangle.value = false),
          () => (following = false),
          () => {
            if (current && approaches.get(current) === approach) approaches.delete(current);
          },
        ),
      );
    },
    { flush: 'post' },
  );

  // The point of another trigger is in the triangle from the last point on this trigger, or from
  // the point where the pointer left it, to the popup. This trigger then follows a crossing, as at a
  // `pointermove` in the triangle: the next move or a rest of 40 ms ends it. A point equal to the
  // apex, such as after a layout change under a still pointer, is in the triangle.
  function approach(point: Point) {
    const trigger = options.trigger.value;
    const popup = root()?.popup;
    if (!(options.hoverablePopup?.() ?? true) || !trigger || !popup || over === 'popup') {
      return false;
    }
    const apex = over === 'trigger' ? last : from;
    if (!apex || !isInTriangle(point, apex, trigger, popup)) return false;
    from = apex;
    over = 'outside';
    setCrossing(true);
    inTriangle.value = true;
    restTimer.start(REST_IN_TRIANGLE, () => {
      setCrossing(false);
      close();
    });
    return true;
  }

  function setCrossing(crossing: boolean) {
    const current = root();
    if (current) crossingOf(current).value = crossing;
  }

  function follow(event: PointerEvent, byHover: boolean) {
    const trigger = options.trigger.value;
    const target = event.target as Element;
    const point = { x: event.clientX, y: event.clientY };
    restTimer.clear();
    inTriangle.value = false;
    if (trigger?.contains(target)) {
      over = 'trigger';
      setCrossing(false);
      closeTimer.clear();
      return;
    }
    if (options.inside(target)) {
      over = 'popup';
      enteredPopup = true;
      setCrossing(false);
      closeTimer.clear();
      if (!byHover) from = null;
      return;
    }
    if (over === 'trigger') from = point;
    over = 'outside';
    if (!byHover && !from) return;
    if (enteredPopup && options.stayAfterEnter) return;
    const popup = root()?.popup;
    const crosses = options.hoverablePopup?.() ?? true;
    if (crosses && from && trigger && popup && isInTriangle(point, from, trigger, popup)) {
      setCrossing(true);
      inTriangle.value = true;
      restTimer.start(REST_IN_TRIANGLE, () => {
        setCrossing(false);
        if (!options.passOn?.(target)) close();
      });
      return;
    }
    from = null;
    // Another trigger under the pointer starts its open before this close.
    setCrossing(false);
    if (!options.passOn?.(target)) close();
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
    listeners: { onPointerenter, onPointermove, onPointerleave, onPointerover },
    /** The pointer moves in the triangle toward the popup that a hover opened. */
    get inTriangle() {
      return inTriangle.value;
    },
    /**
     * The point is in the triangle to the popup that this trigger keeps open, as for the triggers of
     * its root: a trigger of another root, such as a sibling submenu, asks at its own event.
     */
    approaches(point: Point) {
      return following && approach(point);
    },
    /** A press closes the open popup: it came more than 500 ms after the hover open. */
    closesAtPress(event: Event) {
      return !(root()?.reason === 'trigger-hover' && event.timeStamp - openedAt < PATIENT_PRESS);
    },
  };
}

/**
 * Opens the popup after `delay` when its trigger gets the focus of a key, and closes it when the
 * focus leaves the trigger and the popup. A press gives a button and a link no `:focus-visible`
 * (test/measurements/tooltip.test.ts, test/measurements/preview-card.test.ts).
 */
export function useOpenOnFocus(
  root: () => PopupRoot | null,
  options: {
    element: Readonly<Ref<HTMLElement | null>>;
    /**
     * The time from the focus to the open. A popup that is open for another trigger moves at once.
     * @default () => 0
     */
    delay?: () => number;
    /** The trigger opens nothing. */
    disabled?: () => boolean;
    /** The focus event comes from a trigger in this trigger. */
    inner?: (event: FocusEvent) => boolean;
    /**
     * The focus of the trigger opens nothing, until the focus leaves the trigger. A window that
     * loses the focus while the popup is closed sets it, so a popup that Escape closed stays closed
     * when the window gets the focus back. The caller can also set it, as after a press. A text
     * field matches `:focus-visible` at each focus.
     */
    blocked?: { value: boolean };
  },
) {
  const openTimer = useTimeout();
  const later = useTimeout();
  const blocked = options.blocked ?? { value: false };

  function onFocusin(event: FocusEvent) {
    const current = root();
    const element = options.element.value;
    if (!current || !element || options.disabled?.() || blocked.value) return;
    if (options.inner?.(event) || !(event.target as Element).matches(':focus-visible')) return;
    const open = () => root()?.request(true, 'trigger-focus', event, element);
    const delay = options.delay?.() ?? 0;
    if (current.open || delay === 0) open();
    else openTimer.start(delay, open);
  }

  // The focus stays in the popup: in its popup, or on another trigger of the root.
  function staysInside(current: PopupRoot, target: Element) {
    const layer = layerOf(current);
    return (
      options.element.value?.contains(target) ||
      (!!layer && isInPopup(layer, target)) ||
      current.triggers.some((trigger) => !trigger.disabled && trigger.element?.contains(target))
    );
  }

  function close(event: FocusEvent) {
    const current = root();
    if (current?.open && current.activeTrigger === options.element.value) {
      current.request(false, 'trigger-focus', event);
    }
  }

  function onFocusout(event: FocusEvent) {
    openTimer.clear();
    const current = root();
    const element = options.element.value;
    if (!current || !element) return;
    const related = event.relatedTarget as Element | null;
    if (related && !related.shadowRoot) {
      if (!staysInside(current, related)) {
        blocked.value = false;
        close(event);
      }
      return;
    }
    // A focus that moves into a shadow tree has the host as its related target, and a window that
    // loses the focus gives none and keeps the trigger as its active element. A press on an element
    // with no tab stop moves the focus to `<body>` (test/measurements/tooltip.test.ts). So the
    // trigger reads the focused element one task later.
    const doc = ownerDocument(element);
    later.start(0, () => {
      // Chromium sends `focusout` to a focused link that Vue removes
      // (test/measurements/preview-card.test.ts).
      if (!element.isConnected) return;
      const focused = activeElement(doc);
      if (focused === element) {
        if (!current.open) blocked.value = true;
        return;
      }
      if (focused && staysInside(current, focused)) return;
      blocked.value = false;
      close(event);
    });
  }

  return { listeners: { onFocusin, onFocusout } };
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
function isInTriangle(point: Point, from: Point, trigger: Element, popup: Element) {
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
