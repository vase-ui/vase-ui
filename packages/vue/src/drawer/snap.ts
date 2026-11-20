import type { DrawerSnapPoint } from './types';

/** A snap point with its place. */
export interface ResolvedSnapPoint {
  readonly value: DrawerSnapPoint;
  /** The height of the popup that shows at this point. */
  readonly height: number;
  /** The distance from the open place to this point. */
  readonly offset: number;
}

/** The sizes that a snap point resolves against, in pixels. */
export interface SnapSizes {
  readonly popup: number;
  readonly viewport: number;
  readonly rootFontSize: number;
}

/** Two points whose heights differ by this many pixels or less are one point. */
const SAME_HEIGHT = 1;
/** A release speed that moves the target of a snap, in px/ms. */
const SNAP_VELOCITY = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MAX_SNAP_VELOCITY = 4;
/** A release speed toward the closed place that closes the drawer, in px/ms. */
const CLOSE_VELOCITY = 0.5;
/** A drag shorter than this keeps the speed of its last sample, also against the drag. */
const MIN_DRAG = 10;

function within(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * The height of a snap point in pixels: a number up to 1 is a part of the viewport, a larger
 * number is pixels, and a string has the unit `px` or `rem`. Another value has no height.
 */
export function snapPointHeight(point: DrawerSnapPoint, sizes: SnapSizes): number | null {
  if (!(sizes.viewport > 0)) return null;
  if (typeof point === 'number') {
    if (!Number.isFinite(point)) return null;
    return point <= 1 ? within(point, 0, 1) * sizes.viewport : point;
  }
  const value = Number.parseFloat(point);
  if (!Number.isFinite(value)) return null;
  const unit = point.trim();
  if (unit.endsWith('rem')) return value * sizes.rootFontSize;
  if (unit.endsWith('px')) return value;
  return null;
}

/**
 * The places of the snap points, in the order of the list. A height is at most the height of the
 * popup and of the viewport. Of two points with the same height, the last one of the list stays.
 */
export function resolveSnapPoints(
  points: readonly DrawerSnapPoint[] | undefined,
  sizes: SnapSizes,
): ResolvedSnapPoint[] {
  if (!points?.length || !(sizes.popup > 0) || !(sizes.viewport > 0)) return [];
  const max = Math.min(sizes.popup, sizes.viewport);
  const resolved: ResolvedSnapPoint[] = [];
  for (const value of points) {
    const height = snapPointHeight(value, sizes);
    if (height === null) continue;
    const clamped = within(height, 0, max);
    resolved.push({ value, height: clamped, offset: Math.max(0, sizes.popup - clamped) });
  }
  return resolved.filter(
    (point, index) =>
      !resolved
        .slice(index + 1)
        .some((later) => Math.abs(later.height - point.height) <= SAME_HEIGHT),
  );
}

function nearest(points: readonly ResolvedSnapPoint[], target: number, key: 'height' | 'offset') {
  let found = points[0];
  for (const point of points) {
    if (found && Math.abs(point[key] - target) < Math.abs(found[key] - target)) found = point;
  }
  return found;
}

/**
 * The point of a value: its own point, else the kept point with the nearest height. `null` and a
 * value with no height have no point.
 */
export function findSnapPoint(
  points: readonly ResolvedSnapPoint[],
  value: DrawerSnapPoint | null,
  sizes: SnapSizes,
): ResolvedSnapPoint | undefined {
  if (value === null) return undefined;
  const own = points.find((point) => Object.is(point.value, value));
  if (own) return own;
  const height = snapPointHeight(value, sizes);
  if (height === null) return undefined;
  return nearest(points, within(height, 0, Math.min(sizes.popup, sizes.viewport)), 'height');
}

/**
 * The movement of the popup in a swipe from a point at `offset`: past the open place it grows as a
 * square root.
 */
export function snapMovement(offset: number, delta: number) {
  const next = offset + delta;
  return next >= 0 ? delta : -Math.sqrt(-next) - offset;
}

/** The progress of a point between the two points nearest the open place: 0 at the first one. */
export function snapProgress(points: readonly ResolvedSnapPoint[], offset: number | null) {
  if (offset === null || points.length < 2) return 0;
  const [first = 0, second = 0] = points.map((point) => point.offset).sort((a, b) => a - b);
  return within((offset - first) / (second - first), 0, 1);
}

export interface SnapRelease {
  readonly points: readonly ResolvedSnapPoint[];
  /** The offset of the active point. */
  readonly offset: number;
  /** The drag on the axis, toward the closed place. */
  readonly delta: number;
  /** The speed of the last sample toward the closed place, in px/ms. */
  readonly velocity: number;
  /** The speed of the whole drag toward the closed place, in px/ms. */
  readonly dragVelocity: number;
  readonly popupHeight: number;
  /** The speed moves the target one point at most. */
  readonly sequential: boolean;
  /** The drag moved on the axis of the drawer. A drag with no such move never closes. */
  readonly directed: boolean;
}

/** The point where a released swipe goes, or `null` to close the drawer. */
export function releaseSnap(release: SnapRelease): ResolvedSnapPoint | null {
  const { points, offset, delta, popupHeight } = release;
  const direction = Math.sign(delta);
  let velocity = release.velocity;
  // A touch that turns back at its end gives a last sample against the drag.
  if (direction !== 0 && Math.abs(delta) >= MIN_DRAG && Math.sign(velocity) === -direction) {
    velocity = release.dragVelocity;
  }
  const dragged = within(offset + delta, 0, popupHeight);
  const fast = Math.abs(velocity) >= SNAP_VELOCITY;
  const thrown = fast
    ? within(velocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) * SNAP_VELOCITY_MULTIPLIER
    : 0;
  const target = release.sequential ? dragged : within(dragged + thrown, 0, popupHeight);
  const closeOr = (point: ResolvedSnapPoint) => (release.directed ? null : point);
  const ordered = [...points].sort((a, b) => a.offset - b.offset);
  let point = nearest(release.sequential ? ordered : points, target, 'offset');
  if (!point) return null;
  let place = target;

  if (release.sequential) {
    const current = nearest(ordered, offset, 'offset');
    const index = current ? ordered.indexOf(current) : 0;
    if (direction !== 0 && fast && Math.sign(velocity) === direction) {
      const next = ordered[index + direction];
      if (next) {
        if (direction > 0 ? target < next.offset : target > next.offset) {
          point = next;
          place = next.offset;
        }
      } else if (direction > 0) {
        return closeOr(point);
      }
    }
  } else if (velocity >= CLOSE_VELOCITY && delta > 0) {
    return closeOr(point);
  }
  return Math.abs(place - popupHeight) < Math.abs(place - point.offset) ? closeOr(point) : point;
}
