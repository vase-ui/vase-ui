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
