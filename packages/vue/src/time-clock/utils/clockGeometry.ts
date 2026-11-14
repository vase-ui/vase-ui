export interface ClockPoint {
  x: number;
  y: number;
}

export interface ClockRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The ratio of the radius of the outer ring below which a point of a 24-hour face is on the inner
 * ring. It is the middle between the outer ring, at 1, and the inner ring, at `INNER_RING_RADIUS`.
 */
export const INNER_RING_THRESHOLD = 0.82;

/** The radius of the inner ring of a 24-hour face, as a ratio of the radius of the outer ring. */
export const INNER_RING_RADIUS = 0.64;

function distanceFromCenter(point: ClockPoint, rect: ClockRect): number {
  return Math.hypot(point.x - (rect.left + rect.width / 2), point.y - (rect.top + rect.height / 2));
}

/** The angle of `point` seen from the center of `rect`, in degrees from 12 o'clock, clockwise. */
export function angleOfPoint(point: ClockPoint, rect: ClockRect): number {
  const dx = point.x - (rect.left + rect.width / 2);
  const dy = point.y - (rect.top + rect.height / 2);
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

/** The distance of `point` from the center of `rect`, as a ratio of `radius`. */
export function ratioOfPoint(point: ClockPoint, rect: ClockRect, radius: number): number {
  return distanceFromCenter(point, rect) / radius;
}

/**
 * The radius of the outer ring of the face `rect`: the mean distance of the centers of `numbers`
 * from the center of the face. The style sheet of the consumer places the numbers, so only their
 * boxes give the radius. With no numbers, the radius is half of the shorter side of the face.
 */
export function outerRingRadius(rect: ClockRect, numbers: readonly ClockRect[]): number {
  if (numbers.length === 0) {
    return Math.min(rect.width, rect.height) / 2;
  }
  let total = 0;
  for (const number of numbers) {
    total += distanceFromCenter(
      { x: number.left + number.width / 2, y: number.top + number.height / 2 },
      rect,
    );
  }
  return total / numbers.length;
}

/**
 * The position that `angle` selects on a face of `count` equal parts: a whole number from 0 up to
 * `count`, rounded to `step`. The part before `count` is next to the part at 0, so a position that
 * rounds up to `count` is 0.
 */
export function positionOfAngle(angle: number, count: number, step = 1): number {
  const position = Math.round(angle / (360 / count) / step) * step;
  return position >= count ? 0 : position;
}

/** The angle of a position on a face of `count` equal parts, in degrees from 12 o'clock, clockwise. */
export function angleOfPosition(position: number, count: number): number {
  return (position % count) * (360 / count);
}
