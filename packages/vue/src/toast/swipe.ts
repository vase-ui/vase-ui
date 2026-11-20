import { computed, nextTick, shallowRef, type CSSProperties } from 'vue';
import { getElementTransform } from '../common/getElementTransform';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

type Point = { x: number; y: number };

const REVERSE_CANCEL_THRESHOLD = 10;

export function getDisplacement(direction: SwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case 'up':
      return -deltaY;
    case 'down':
      return deltaY;
    case 'left':
      return -deltaX;
    case 'right':
      return deltaX;
    default:
      return 0;
  }
}

export function applyDirectionalDamping(
  deltaX: number,
  deltaY: number,
  directions: readonly SwipeDirection[],
) {
  const dampAxis = (delta: number, negative: SwipeDirection, positive: SwipeDirection) =>
    (delta < 0 && !directions.includes(negative)) || (delta > 0 && !directions.includes(positive))
      ? Math.sign(delta) * Math.abs(delta) ** 0.5
      : delta;

  return {
    x: dampAxis(deltaX, 'left', 'right'),
    y: dampAxis(deltaY, 'up', 'down'),
  };
}

export function updateSwipeCancelBaseline(baseline: Point, position: Point, movement: Point) {
  const clampAxis = (pos: number, base: number, move: number) =>
    (move < 0 && pos > base) || (move > 0 && pos < base) ? pos : base;

  return {
    x: clampAxis(position.x, baseline.x, movement.x),
    y: clampAxis(position.y, baseline.y, movement.y),
  };
}

export function shouldCancelReverseSwipe(
  directions: readonly SwipeDirection[],
  maxDisplacement: number,
  currentDisplacement: number,
) {
  return (
    !(directions.includes('left') && directions.includes('right')) &&
    !(directions.includes('up') && directions.includes('down')) &&
    maxDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
  );
}

export function getDismissDirection(
  directions: readonly SwipeDirection[],
  deltaX: number,
  deltaY: number,
  threshold: number,
): SwipeDirection | undefined {
  return directions.find((direction) => getDisplacement(direction, deltaX, deltaY) > threshold);
}

const SWIPE_THRESHOLD = 40;
const IGNORE_SELECTOR = 'button, a, input, textarea, [role="button"], [data-vase-ui-swipe-ignore]';

interface Gesture {
  pointerId: number;
  start: { x: number; y: number };
  transform: { x: number; y: number; scale: number };
  cancelBaseline: { x: number; y: number };
  axis: 'horizontal' | 'vertical' | null;
  real: boolean;
  intended: SwipeDirection | undefined;
  maxDisplacement: number;
  cancelled: boolean;
}

/** The swipe that closes a toast. */
export function useToastSwipe(options: {
  directions: () => readonly SwipeDirection[];
  close: () => void;
}) {
  const swiping = shallowRef(false);
  const direction = shallowRef<SwipeDirection>();
  const offset = shallowRef({ x: 0, y: 0 });
  const transform = shallowRef({ x: 0, y: 0, scale: 1 });
  let gesture: Gesture | null = null;

  const enabled = computed(() => options.directions().length > 0);

  function onPointerdown(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest(IGNORE_SELECTOR)) return;
    const element = event.currentTarget as HTMLElement;
    const start = getElementTransform(element);
    gesture = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      transform: start,
      cancelBaseline: { x: event.clientX, y: event.clientY },
      axis: null,
      real: false,
      intended: undefined,
      maxDisplacement: 0,
      cancelled: false,
    };
    transform.value = start;
    offset.value = { x: start.x, y: start.y };
    swiping.value = true;
    // With capture, the root gets each move and the release, also outside it.
    element.setPointerCapture(event.pointerId);
  }

  function onPointermove(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return;
    const directions = options.directions();
    const { clientX, clientY } = event;
    gesture.cancelBaseline = updateSwipeCancelBaseline(
      gesture.cancelBaseline,
      { x: clientX, y: clientY },
      { x: event.movementX, y: event.movementY },
    );
    const deltaX = clientX - gesture.start.x;
    const deltaY = clientY - gesture.start.y;
    const horizontal = directions.includes('left') || directions.includes('right');
    const vertical = directions.includes('up') || directions.includes('down');

    if (!gesture.real && Math.hypot(deltaX, deltaY) >= 1) {
      gesture.real = true;
      if (horizontal && vertical) {
        gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      }
    }

    if (gesture.intended) {
      const displacement = getDisplacement(
        gesture.intended,
        clientX - gesture.cancelBaseline.x,
        clientY - gesture.cancelBaseline.y,
      );
      if (displacement > SWIPE_THRESHOLD) {
        gesture.cancelled = false;
        direction.value = gesture.intended;
      } else if (shouldCancelReverseSwipe(directions, gesture.maxDisplacement, displacement)) {
        gesture.cancelled = true;
      }
    } else {
      const candidate = candidateOf(gesture.axis, deltaX, deltaY);
      if (candidate && directions.includes(candidate)) {
        gesture.intended = candidate;
        gesture.maxDisplacement = getDisplacement(candidate, deltaX, deltaY);
        direction.value = candidate;
      }
    }

    const damped = applyDirectionalDamping(deltaX, deltaY, directions);
    offset.value = {
      x: gesture.transform.x + (gesture.axis !== 'vertical' && horizontal ? damped.x : 0),
      y: gesture.transform.y + (gesture.axis !== 'horizontal' && vertical ? damped.y : 0),
    };
  }

  function onPointerup(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return;
    end(!gesture.cancelled);
  }

  // `pointercancel`, and a capture that the root loses in a swipe, end it with no dismissal.
  function onPointercancel(event: PointerEvent) {
    if (gesture?.pointerId === event.pointerId) end(false);
  }

  function end(canDismiss: boolean) {
    gesture = null;
    swiping.value = false;
    const movement = movementOf();
    const dismissal = canDismiss
      ? getDismissDirection(options.directions(), movement.x, movement.y, SWIPE_THRESHOLD)
      : undefined;
    if (!dismissal) {
      offset.value = { x: transform.value.x, y: transform.value.y };
      direction.value = undefined;
      return;
    }
    direction.value = dismissal;
    // Vue does not patch an element that leaves, so the direction and the movement reach the
    // element before the close (test/measurements/toast.test.ts).
    void nextTick(options.close);
  }

  function movementOf() {
    return { x: offset.value.x - transform.value.x, y: offset.value.y - transform.value.y };
  }

  const style = computed<CSSProperties>(() => {
    const movement = movementOf();
    const directions = options.directions();
    const horizontal = directions.includes('left') || directions.includes('right');
    const vertical = directions.includes('up') || directions.includes('down');
    return {
      '--toast-swipe-movement-x': `${movement.x}px`,
      '--toast-swipe-movement-y': `${movement.y}px`,
      // The browser starts no pan on the axis of the swipe, so it sends no `pointercancel`
      // (test/measurements/toast.test.ts).
      touchAction: !enabled.value
        ? undefined
        : horizontal && vertical
          ? 'none'
          : horizontal
            ? 'pan-y'
            : 'pan-x',
      ...(swiping.value && {
        transition: 'none',
        transform: `translateX(${offset.value.x}px) translateY(${offset.value.y}px) scale(${transform.value.scale})`,
        // Firefox and WebKit select text in the drag (test/measurements/toast.test.ts).
        'user-select': 'none',
        '-webkit-user-select': 'none',
      }),
    };
  });

  const listeners = computed(() =>
    enabled.value
      ? {
          onPointerdown,
          onPointermove,
          onPointerup,
          onPointercancel,
          onLostpointercapture: onPointercancel,
        }
      : {},
  );

  return { swiping, direction, style, listeners };
}

function candidateOf(
  axis: 'horizontal' | 'vertical' | null,
  deltaX: number,
  deltaY: number,
): SwipeDirection | undefined {
  if (axis === 'vertical') return deltaY === 0 ? undefined : deltaY > 0 ? 'down' : 'up';
  if (axis === 'horizontal') return deltaX === 0 ? undefined : deltaX > 0 ? 'right' : 'left';
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX > 0 ? 'right' : 'left';
  return deltaY > 0 ? 'down' : 'up';
}
