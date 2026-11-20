import { onScopeDispose, shallowRef } from 'vue';
import type { DrawerSwipeDirection } from './types';

export type Axis = 'x' | 'y';

/** A swipe closes the drawer past half of the popup, and at least past this many pixels. */
const MIN_CLOSE_DISTANCE = 10;
/** A drag toward the closed place at this speed or more closes the drawer, in px/ms. */
const CLOSE_VELOCITY = 0.5;
/** A swipe that opens keeps the drawer open at this speed or more, in px/ms. */
const OPEN_VELOCITY = 0.1;
/** The size of a popup that does not have one yet. */
const FALLBACK_OPEN_DISTANCE = 40;
/** A touch decides who has the drag at its first move this far from its start on one axis. */
const CLAIM_DISTANCE = 6;
/** The speed of a drag counts from this long at least, in ms. */
const MIN_VELOCITY_DURATION = 50;
/** Less than one frame at 240 Hz, so it changes only samples that are almost at the same time. */
const MIN_SAMPLE_DURATION = 4;
/** A release this long after the last sample has no speed of a sample, in ms. */
const MAX_SAMPLE_AGE = 80;
/** A move shorter than this in pixels is no sample. */
const MIN_SAMPLE_DISTANCE = 1;
const MIN_RELEASE_VELOCITY = 0.2;
const MAX_RELEASE_VELOCITY = 4;
const MIN_RELEASE_DURATION = 80;
const MAX_RELEASE_DURATION = 360;
const MIN_STRENGTH = 0.1;

/** A swipe starts on no such element in the popup with a mouse or a pen. */
const INTERACTIVE = 'button,a,input,select,textarea,label,[role="button"]';

export const SWIPE_IGNORE = 'data-vase-ui-swipe-ignore';

export function axisOf(direction: DrawerSwipeDirection): Axis {
  return direction === 'left' || direction === 'right' ? 'x' : 'y';
}

/** The opposite direction: the direction of a swipe that opens a drawer. */
export function oppositeOf(direction: DrawerSwipeDirection): DrawerSwipeDirection {
  return ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[direction];
}

/** The part of a movement in a direction. */
export function along(direction: DrawerSwipeDirection, x: number, y: number) {
  const value = axisOf(direction) === 'x' ? x : y;
  return direction === 'up' || direction === 'left' ? -value : value;
}

/** A movement of `distance` in a direction, as a movement on the two axes. */
export function toward(direction: DrawerSwipeDirection, distance: number) {
  const value = direction === 'up' || direction === 'left' ? -distance : distance;
  return axisOf(direction) === 'x' ? { x: value, y: 0 } : { x: 0, y: value };
}

/** Against the direction, a movement grows as a square root. */
export function resist(movement: number) {
  return movement < 0 ? -Math.sqrt(-movement) : movement;
}

function within(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** A release closes the drawer: a movement past half of the popup, or a fast drag. */
export function closesAtRelease(size: number, movement: number, velocity: number) {
  if (movement <= 0) return false;
  return velocity >= CLOSE_VELOCITY || movement > Math.max(size * 0.5, MIN_CLOSE_DISTANCE);
}

/** A release of a swipe that opens keeps the drawer open. */
export function opensAtRelease(size: number | null, movement: number, velocity: number) {
  return movement >= (size ? size * 0.5 : FALLBACK_OPEN_DISTANCE) || velocity >= OPEN_VELOCITY;
}

/**
 * The part of the leave that is left after a swipe, from 0.1 to 1: the distance that is left to
 * the closed place, at the speed of the release.
 */
export function releaseStrength(size: number, traveled: number, velocity: number) {
  const left = size - traveled;
  if (!(size > 0) || left <= 0 || !(velocity > MIN_RELEASE_VELOCITY)) return 1;
  const duration = within(
    left / within(velocity, MIN_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY),
    MIN_RELEASE_DURATION,
    MAX_RELEASE_DURATION,
  );
  return (
    MIN_STRENGTH +
    ((duration - MIN_RELEASE_DURATION) / (MAX_RELEASE_DURATION - MIN_RELEASE_DURATION)) *
      (1 - MIN_STRENGTH)
  );
}

/** The element scrolls on the axis: it has `overflow` `auto` or `scroll`, and more content. */
export function scrollsOn(element: Element, axis: Axis) {
  const style = getComputedStyle(element);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  return axis === 'x'
    ? element.scrollWidth > element.clientWidth
    : element.scrollHeight > element.clientHeight;
}

/** The scroller can go no further in the direction of the swipe that closes the drawer. */
function atEdge(scroller: Element, direction: DrawerSwipeDirection) {
  const x = axisOf(direction) === 'x';
  const offset = x ? scroller.scrollLeft : scroller.scrollTop;
  const max = x
    ? scroller.scrollWidth - scroller.clientWidth
    : scroller.scrollHeight - scroller.clientHeight;
  return direction === 'down' || direction === 'right' ? offset <= 0 : offset >= max - 1;
}

/** The elements of an event path, from its target to `last`, with `last`. */
export function pathTo(event: Event, last: Element) {
  const path = event.composedPath();
  const index = path.indexOf(last);
  return (index === -1 ? [] : path.slice(0, index + 1)).filter(
    (node): node is Element => (node as Node).nodeType === 1,
  );
}

/**
 * A mouse or a pen can start a swipe at this press: it is in the popup, and not on an element
 * that has its own use of a drag.
 */
export function pressStartsSwipe(event: PointerEvent, popup: Element, axis: Axis) {
  const between = pathTo(event, popup).slice(0, -1);
  if (between.length === 0 && !event.composedPath().includes(popup)) return false;
  return !between.some(
    (element) =>
      element.matches(INTERACTIVE) ||
      element.hasAttribute(SWIPE_IGNORE) ||
      scrollsOn(element, axis),
  );
}

/**
 * No swipe starts on an element with `data-vase-ui-swipe-ignore` or on a range input. With the
 * value `x` or `y`, the element takes a touch drag on that axis, and a touch drag on the other
 * axis moves the drawer.
 */
export function ignoresTouch(path: readonly Element[], axis: Axis) {
  const other: Axis = axis === 'x' ? 'y' : 'x';
  return path.some(
    (element) =>
      (element.hasAttribute(SWIPE_IGNORE) && element.getAttribute(SWIPE_IGNORE) !== other) ||
      (element.localName === 'input' && (element as HTMLInputElement).type === 'range'),
  );
}

/**
 * The swipe takes a touch drag from the browser: the move is on the axis of the drawer, and the
 * nearest scroller on that axis, if one is there, can go no further in the direction of the move.
 */
export function claimsTouch(
  path: readonly Element[],
  direction: DrawerSwipeDirection,
  x: number,
  y: number,
) {
  const axis = axisOf(direction);
  if (Math.abs(axis === 'x' ? y : x) > Math.abs(axis === 'x' ? x : y)) return false;
  const scroller = path.find((element) => scrollsOn(element, axis));
  return !scroller || (along(direction, x, y) > 0 && atEdge(scroller, direction));
}

/** The end of a drag: its movement and its speed. */
export interface SwipeRelease {
  readonly event: PointerEvent;
  /** The movement from the start of the movement, in pixels. */
  readonly x: number;
  readonly y: number;
  /** The speed of the drag from the press, in px/ms. */
  readonly velocityX: number;
  readonly velocityY: number;
  /** The speed of the last sample, in px/ms. */
  readonly lastVelocityX: number;
  readonly lastVelocityY: number;
  /** A move went more on the axis than across it. */
  readonly directed: boolean;
}

export interface SwipeTrackerOptions {
  readonly axis: () => Axis;
  /** A press can start a swipe. A touch then waits for its claim. */
  press(event: PointerEvent): boolean;
  /** At the first move of a touch 6 px from its start: the swipe takes the drag. */
  claim?(x: number, y: number): boolean;
  /** The movement starts at the first move for which this is true. */
  begins?(event: PointerEvent): boolean;
  /** The tracker captures a mouse at its press, else at its first move. */
  readonly captureAtPress?: boolean;
  /** The swipe has the drag. */
  start(event: PointerEvent): void;
  move(x: number, y: number, event: PointerEvent): void;
  /** The drag ends: with its release, or with none. */
  end(release: SwipeRelease | null): void;
  /** The press ends, with a drag or with none. */
  done?(): void;
}

interface Gesture {
  readonly id: number;
  readonly type: string;
  readonly target: Element;
  readonly pressX: number;
  readonly pressY: number;
  /** The touch decided who has the drag; `false`: the browser has it. */
  claimed: boolean | undefined;
  started: boolean;
  /** The place where the movement starts. */
  originX: number;
  originY: number;
  moveTime: number | undefined;
  directed: boolean;
  sample: { x: number; y: number; time: number } | undefined;
  stationary: boolean;
  lastVelocityX: number;
  lastVelocityY: number;
  lastX: number;
  lastY: number;
}

/**
 * Follows one pointer for a swipe: a mouse, a pen or a touch. Bind `listeners` to the element and
 * `onTouchmove` in the capture phase, as a listener that is not passive.
 */
export function useSwipeTracker(options: SwipeTrackerOptions) {
  const swiping = shallowRef(false);
  let gesture: Gesture | undefined;

  function finish(release: SwipeRelease | null) {
    const current = gesture;
    gesture = undefined;
    if (current) options.done?.();
    if (!current?.started) return;
    if (current.type !== 'touch' && current.target.hasPointerCapture(current.id)) {
      current.target.releasePointerCapture(current.id);
    }
    swiping.value = false;
    options.end(release);
  }

  function sample(current: Gesture, event: PointerEvent) {
    const { clientX: x, clientY: y, timeStamp: time } = event;
    const last = current.sample;
    if (last && time > last.time) {
      // Some Android devices send one move that is almost still just before the release. The
      // tracker keeps the last sample that moved. A second still move ends the speed.
      const still =
        Math.abs(x - last.x) < MIN_SAMPLE_DISTANCE && Math.abs(y - last.y) < MIN_SAMPLE_DISTANCE;
      const skip = still && !current.stationary;
      current.stationary = still;
      if (skip) return;
      const duration = Math.max(time - last.time, MIN_SAMPLE_DURATION);
      current.lastVelocityX = (x - last.x) / duration;
      current.lastVelocityY = (y - last.y) / duration;
    }
    current.sample = { x, y, time };
  }

  function releaseOf(current: Gesture, event: PointerEvent): SwipeRelease {
    const duration = Math.max(event.timeStamp - (current.moveTime ?? event.timeStamp), 0);
    const time = duration > 0 ? Math.max(duration, MIN_VELOCITY_DURATION) : 0;
    let lastVelocityX = current.lastVelocityX;
    let lastVelocityY = current.lastVelocityY;
    const last = current.sample;
    if (last && event.timeStamp >= last.time) {
      const age = event.timeStamp - last.time;
      if (age > MAX_SAMPLE_AGE) {
        lastVelocityX = 0;
        lastVelocityY = 0;
      } else {
        const sampleTime = Math.max(age, MIN_SAMPLE_DURATION);
        if (Math.abs(current.lastX - last.x) >= MIN_SAMPLE_DISTANCE) {
          lastVelocityX = (current.lastX - last.x) / sampleTime;
        }
        if (Math.abs(current.lastY - last.y) >= MIN_SAMPLE_DISTANCE) {
          lastVelocityY = (current.lastY - last.y) / sampleTime;
        }
      }
    }
    return {
      event,
      x: current.lastX - current.originX,
      y: current.lastY - current.originY,
      velocityX: time ? (current.lastX - current.pressX) / time : 0,
      velocityY: time ? (current.lastY - current.pressY) / time : 0,
      lastVelocityX,
      lastVelocityY,
      directed: current.directed,
    };
  }

  function begin(current: Gesture, event: PointerEvent) {
    current.started = true;
    current.originX = event.clientX;
    current.originY = event.clientY;
    if (current.type !== 'touch' && !current.target.hasPointerCapture(current.id)) {
      current.target.setPointerCapture(current.id);
    }
    swiping.value = true;
    options.start(event);
  }

  function onPointerdown(event: PointerEvent) {
    if (gesture || event.button !== 0 || !options.press(event)) return;
    const target = event.currentTarget as Element;
    gesture = {
      id: event.pointerId,
      type: event.pointerType,
      target,
      pressX: event.clientX,
      pressY: event.clientY,
      claimed: event.pointerType === 'touch' && options.claim ? undefined : true,
      started: false,
      originX: event.clientX,
      originY: event.clientY,
      moveTime: undefined,
      directed: false,
      sample: undefined,
      stationary: false,
      lastVelocityX: 0,
      lastVelocityY: 0,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    if (options.captureAtPress && event.pointerType !== 'touch') {
      target.setPointerCapture(event.pointerId);
    }
  }

  /** At 6 px from the start on one axis, a touch decides one time who has the drag. */
  function decide(current: Gesture, x: number, y: number) {
    const dx = x - current.pressX;
    const dy = y - current.pressY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CLAIM_DISTANCE) return;
    current.claimed = options.claim?.(dx, dy) ?? true;
  }

  function onPointermove(event: PointerEvent) {
    const current = gesture;
    if (current?.id !== event.pointerId) return;
    if (current.type !== 'touch') {
      // A press of another button in the drag takes the pointer: the menu of the context.
      if (event.buttons !== 0 && (event.buttons & 1) === 0) {
        finish(null);
        return;
      }
      if (event.buttons === 0 && !current.started) {
        finish(null);
        return;
      }
    }
    current.moveTime ??= event.timeStamp;
    if (current.claimed === undefined) decide(current, event.clientX, event.clientY);
    if (current.claimed !== true) return;
    current.lastX = event.clientX;
    current.lastY = event.clientY;
    if (!current.started) {
      if (options.begins && !options.begins(event)) return;
      begin(current, event);
    }
    const x = current.lastX - current.originX;
    const y = current.lastY - current.originY;
    const axis = options.axis();
    if (Math.abs(axis === 'x' ? x : y) > Math.abs(axis === 'x' ? y : x)) current.directed = true;
    sample(current, event);
    options.move(x, y, event);
    // A fast flick on a trackpad sends a move with no button before its `pointerup`.
    if (current.type === 'mouse' && event.buttons === 0) finish(releaseOf(current, event));
  }

  function onPointerup(event: PointerEvent) {
    const current = gesture;
    if (current?.id !== event.pointerId) return;
    finish(current.started ? releaseOf(current, event) : null);
  }

  function onCancel(event: PointerEvent | MouseEvent) {
    if (!gesture) return;
    if ('pointerId' in event && event.pointerId !== gesture.id) return;
    finish(null);
  }

  onScopeDispose(() => finish(null));

  return {
    /** The swipe has the drag. */
    swiping,
    listeners: {
      onPointerdown,
      onPointermove,
      onPointerup,
      onPointercancel: onCancel,
      // After a press of another button, Chromium sends no `pointerup` (M2).
      onLostpointercapture: onCancel,
      // The menu of the context is the one event that the three browsers send at that press (M2).
      onContextmenu: onCancel,
    },
    /** The swipe takes each move of its touch from the browser. */
    onTouchmove(event: TouchEvent) {
      const current = gesture;
      const touch = event.touches[0];
      if (current?.type !== 'touch' || !touch) return;
      if (current.claimed === undefined) {
        decide(current, touch.clientX, touch.clientY);
      }
      if (current.claimed !== true || event.touches.length !== 1) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    },
    /** Ends the drag with no release. */
    cancel: () => finish(null),
    /** A press goes on. */
    get pressing() {
      return !!gesture;
    },
  };
}
