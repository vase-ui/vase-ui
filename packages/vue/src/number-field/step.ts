import { clamp } from '../common/clamp';

// A snap adds this part of the amount, so that binary noise does not move a value of the grid to
// the cell before it (100.1 + 0.1 gives 100.19999999999999).
const snapTolerance = 1e-10;
// The largest move that the cleanup of binary noise makes, so that it keeps the digits of a large
// number.
const maxCleanup = 1e-10;

export interface Step {
  direction: 1 | -1;
  amount: number;
  /** The number of steps of `amount`. */
  count: number;
  /** The amount is the small step, so a snap goes to the nearest multiple. */
  small: boolean;
}

export interface StepLimits {
  /** The result is a multiple of the amount, counted from `min`, or from 0 with no `min`. */
  snap: boolean;
  min: number | undefined;
  max: number | undefined;
  /** Rounds the result as the format does. */
  round(value: number): number;
}

/**
 * The value after a step from `from`. A snap comes before the range, so that a bound that is not
 * a multiple of the amount is in reach.
 */
export function stepValue(from: number, step: Step, limits: StepLimits) {
  let next = from + step.direction * step.amount * step.count;
  if (limits.snap && step.amount !== 0) {
    next = snap(next, limits.min ?? 0, step.direction * step.amount, step.small);
  }
  return roundInRange(withoutNoise(next), limits);
}

/**
 * The value in the range, rounded as the format rounds it. The value goes into the range before
 * the rounding, so that it shows a number of the range, and after it, because a rounding can move
 * it out again.
 */
export function roundInRange(
  value: number,
  limits: Pick<StepLimits, 'min' | 'max' | 'round'>,
): number {
  const { min, max } = limits;
  return intoRange(limits.round(intoRange(value, min, max)), min, max);
}

export function intoRange(value: number, min: number | undefined, max: number | undefined) {
  return clamp(value, min ?? -Infinity, max ?? Infinity);
}

/**
 * The multiple of `step` from `base` that is nearest to `value`, or the one in the cell where
 * `value` is: the lower one for a step up, the upper one for a step down.
 */
function snap(value: number, base: number, step: number, nearest: boolean) {
  const size = Math.abs(step);
  const direction = Math.sign(step);
  const steps = value - base + size * snapTolerance * direction;
  if (nearest) return base + Math.round(steps / step) * step;
  return base + (direction > 0 ? Math.floor(steps / size) : Math.ceil(steps / size)) * size;
}

/**
 * Removes the binary noise of a sum, such as 0.7 + 0.1, at 15 significant digits. It leaves a
 * number that the cleanup would move by more than one unit of its last place or by more than
 * `maxCleanup`, because those digits can be real.
 */
function withoutNoise(value: number) {
  if (!Number.isFinite(value)) return value;
  const clean = Number.parseFloat(value.toPrecision(15));
  const tolerance = Math.min(Number.EPSILON * Math.max(1, Math.abs(value)), maxCleanup);
  return Math.abs(clean - value) <= tolerance ? clean : value;
}
