import { clamp } from '../common/clamp';
import { normalizeScrollOffset } from '../utils/scrollEdges';

/** The shortest thumb, in pixels. */
export const MIN_THUMB_LENGTH = 16;

/**
 * The distances of an axis to its start edge and to its end edge. `position` counts from the start
 * of the axis, and `max` is the scroll size less the client size.
 */
export function edgeDistances(position: number, max: number): [start: number, end: number] {
  const start = normalizeScrollOffset(position, max);
  return [start, Math.max(0, max - start)];
}

/** The length of a thumb in a free length of `track` pixels. */
export function thumbLength(track: number, client: number, scroll: number) {
  return Math.max(MIN_THUMB_LENGTH, (track * client) / scroll);
}

/**
 * The distance of a thumb from the start of its free length, and its length. Out of the range, as
 * in the rubber band of WebKit, the thumb stays at that edge and becomes shorter, as a native one.
 */
export function thumbPlace(
  position: number,
  max: number,
  track: number,
  length: number,
  scroll: number,
): { offset: number; length: number } {
  const outside = position - clamp(position, 0, Math.max(0, max));
  if (outside !== 0) {
    const shorter = Math.max(MIN_THUMB_LENGTH, (length * scroll) / (scroll + Math.abs(outside)));
    return { offset: outside < 0 ? 0 : Math.max(0, track - shorter), length: shorter };
  }
  const [start] = edgeDistances(position, max);
  return { offset: max > 0 ? (start / max) * Math.max(0, track - length) : 0, length };
}

/**
 * The scroll position for a thumb that the pointer moved `distance` pixels from the press. A thumb
 * that fills its track does not move.
 */
export function dragPosition(
  startPosition: number,
  distance: number,
  track: number,
  length: number,
  max: number,
) {
  const free = track - length;
  return free <= 0 ? startPosition : startPosition + (distance / free) * max;
}

/**
 * The distance from the start of the axis that puts the centre of the thumb at `point`, a distance
 * from the start of the free length, or as near as the range permits. `undefined` when the thumb
 * fills its track.
 */
export function trackPressPosition(point: number, track: number, length: number, max: number) {
  const free = track - length;
  if (free <= 0) return undefined;
  return clamp((point - length / 2) / free, 0, 1) * max;
}

/**
 * The scroll position after a wheel delta, in the range `min` to `max`. `undefined` when the position
 * does not change, so that the browser keeps the event and scrolls a parent.
 */
export function wheelPosition(position: number, delta: number, min: number, max: number) {
  if (delta === 0 || (delta < 0 && position <= min) || (delta > 0 && position >= max)) {
    return undefined;
  }
  return clamp(position + delta, min, max);
}
