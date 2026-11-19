/** The values that a slider can have: `min + n × step`, up to `max`. */
export interface Grid {
  min: number;
  max: number;
  step: number;
}

export type ThumbCollisionBehavior = 'push' | 'swap' | 'none';

function decimals(value: number) {
  const [digits = '', exponent = '0'] = String(value).split('e');
  return Math.max(0, (digits.split('.')[1]?.length ?? 0) - Number(exponent));
}

/**
 * The value of the grid that is nearest to `value`; a middle goes up. With `direction`, the next
 * value of the grid in that direction. Twelve digits remove the error of floating point, and the
 * decimals of `step` and `min` make the value exact: `0.2 + 0.1` is `0.3`.
 */
function onGrid(value: number, grid: Grid, direction: -1 | 0 | 1 = 0) {
  const round = direction === 0 ? Math.round : direction > 0 ? Math.ceil : Math.floor;
  const steps = round(Number(((value - grid.min) / grid.step).toPrecision(12)));
  const digits = Math.min(100, Math.max(decimals(grid.step), decimals(grid.min)));
  return Number((grid.min + steps * grid.step).toFixed(digits));
}

/** The largest value: `max`, or the last value of the grid below it. */
export function largest(grid: Grid) {
  return onGrid(grid.max, grid, -1);
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}

/** A value of the grid, between `min` and the largest value. */
export function snap(value: number, grid: Grid, direction: -1 | 0 | 1 = 0) {
  if (!(grid.max > grid.min) || Number.isNaN(value)) return grid.min;
  return clamp(onGrid(value, grid, direction), grid.min, largest(grid));
}

/** The place of a value between `min` and `max`, in percent. */
export function percent(value: number, grid: Grid) {
  return grid.max > grid.min ? ((value - grid.min) / (grid.max - grid.min)) * 100 : 0;
}

/** The values as the slider shows them: on the grid, in ascending order. */
export function shownValues(model: number | readonly number[], grid: Grid): number[] {
  const given = typeof model === 'number' ? [model] : model;
  return given.map((value) => snap(value, grid)).sort((a, b) => a - b);
}

/** The same numbers in the same order. */
export function sameValues(a: number | readonly number[], b: number | readonly number[]) {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/** The least and the largest value of a thumb, from its neighbours and the least distance. */
export function limits(values: readonly number[], index: number, grid: Grid, distance: number) {
  const before = values[index - 1];
  const after = values[index + 1];
  return [
    before === undefined ? grid.min : onGrid(before + distance, grid, 1),
    after === undefined ? largest(grid) : onGrid(after - distance, grid, -1),
  ] as const;
}

/* eslint-disable @typescript-eslint/no-non-null-assertion -- Each index is the index of a value of the list: the caller gives the index of a thumb with a value, and the loops stay in the list. */

/**
 * A key or an `input` event moves the thumb `index` toward `target`, to its limit at most. A thumb
 * with no room stays.
 */
export function moveThumb(
  values: readonly number[],
  index: number,
  target: number,
  grid: Grid,
  distance: number,
) {
  const current = values[index]!;
  const [low, high] = limits(values, index, grid, distance);
  const next = clamp(target, low, high);
  if (target > current ? next < current : next > current) return values;
  const moved = values.slice();
  moved[index] = next;
  return moved;
}

/** The thumb that a press at `target` moves: the enabled thumb whose value is nearest. */
export function nearestThumb(values: readonly number[], target: number, enabled: boolean[]) {
  let nearest = -1;
  for (const [index, value] of values.entries()) {
    if (!enabled[index]) continue;
    const distance = Math.abs(value - target);
    const best = nearest === -1 ? Infinity : Math.abs(values[nearest]! - target);
    // Of thumbs with the same value, the last one moves up and the first one moves down.
    if (target > value ? distance <= best : distance < best) nearest = index;
  }
  return nearest;
}

/**
 * A drag of the thumb `index` to `target`, by the rule of `behavior`. Returns the values and the
 * thumb that the drag goes on with. A disabled thumb does not move.
 */
export function dragThumb(
  values: readonly number[],
  index: number,
  target: number,
  options: { grid: Grid; distance: number; behavior: ThumbCollisionBehavior; disabled: boolean[] },
): { values: readonly number[]; index: number } {
  const { grid, distance, behavior, disabled } = options;
  const next = values.slice();
  let moving = index;
  if (behavior === 'push') {
    return { values: push(next, index, target, grid, distance, disabled), index };
  }
  if (behavior === 'swap') {
    // At the value of a neighbour, the drag goes on with that neighbour. The thumb that it leaves
    // stops at its limit.
    const up = target > next[moving]!;
    const down = target < next[moving]!;
    while (up && moving < next.length - 1 && !disabled[moving + 1] && target >= next[moving + 1]!) {
      next[moving] = onGrid(next[moving + 1]! - distance, grid, -1);
      moving += 1;
    }
    while (down && moving > 0 && !disabled[moving - 1] && target <= next[moving - 1]!) {
      next[moving] = onGrid(next[moving - 1]! + distance, grid, 1);
      moving -= 1;
    }
  }
  const [low, high] = limits(next, moving, grid, distance);
  if (low > high) return { values, index };
  next[moving] = clamp(target, low, high);
  return { values: next, index: moving };
}

/**
 * The thumb `index` goes to `target` and pushes each thumb in its way, to `min` or `max` at most.
 * A disabled thumb is a wall: the thumbs before it keep the least distance to it.
 */
function push(
  next: number[],
  index: number,
  target: number,
  grid: Grid,
  distance: number,
  disabled: boolean[],
) {
  let low = grid.min + index * distance;
  for (let other = index - 1; other >= 0; other -= 1) {
    if (disabled[other]) {
      low = next[other]! + (index - other) * distance;
      break;
    }
  }
  let high = largest(grid) - (next.length - 1 - index) * distance;
  for (let other = index + 1; other < next.length; other += 1) {
    if (disabled[other]) {
      high = next[other]! - (other - index) * distance;
      break;
    }
  }
  [low, high] = [onGrid(low, grid, 1), onGrid(high, grid, -1)];
  if (low > high) return next;
  next[index] = clamp(target, low, high);
  for (let other = index + 1; other < next.length; other += 1) {
    next[other] = Math.max(next[other]!, onGrid(next[other - 1]! + distance, grid, 1));
  }
  for (let other = index - 1; other >= 0; other -= 1) {
    next[other] = Math.min(next[other]!, onGrid(next[other + 1]! - distance, grid, -1));
  }
  return next;
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */
