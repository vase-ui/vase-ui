import { describe, expect, test } from 'vitest';
import {
  dragThumb,
  largest,
  moveThumb,
  nearestThumb,
  percent,
  sameValues,
  shownValues,
  snap,
  type Grid,
  type ThumbCollisionBehavior,
} from './values';

const percents: Grid = { min: 0, max: 100, step: 1 };

describe('the grid', () => {
  test.each([
    { name: 'a middle goes up', value: 35, grid: { min: 0, max: 100, step: 10 }, shown: 40 },
    { name: 'a value below a middle goes down', value: 33, grid: { min: 0, max: 100, step: 10 }, shown: 30 },
    { name: 'the grid starts at min', value: 7, grid: { min: 1, max: 100, step: 5 }, shown: 6 },
    { name: 'a decimal step is exact', value: 0.1 + 0.2, grid: { min: 0, max: 1, step: 0.1 }, shown: 0.3 },
    { name: 'a middle of a decimal step goes up', value: 0.35, grid: { min: 0, max: 1, step: 0.1 }, shown: 0.4 },
    { name: 'a step of 1e-8', value: 0.123456789, grid: { min: 0, max: 1, step: 0.00000001 }, shown: 0.12345679 },
    { name: 'a step of 1e-8 below zero', value: -0.123456789, grid: { min: -1, max: 0, step: 0.00000001 }, shown: -0.12345679 },
    { name: 'the decimals of min', value: 0.35, grid: { min: 0.25, max: 10, step: 0.1 }, shown: 0.35 },
    { name: 'a step above one with the decimals of min', value: 13.2, grid: { min: 10.2, max: 20, step: 1.5 }, shown: 13.2 },
    { name: 'max off the grid gives the last value below it', value: 108, grid: { min: 6, max: 108, step: 10 }, shown: 106 },
    { name: 'a value above max', value: 150, grid: percents, shown: 100 },
    { name: 'a value below min', value: -10, grid: percents, shown: 0 },
    { name: 'NaN', value: Number.NaN, grid: percents, shown: 0 },
    { name: 'max equal to min', value: 50, grid: { min: 10, max: 10, step: 1 }, shown: 10 },
    { name: 'max below min', value: 50, grid: { min: 10, max: 0, step: 1 }, shown: 10 },
  ])('$name: $value shows as $shown', ({ value, grid, shown }) => {
    expect(snap(value, grid)).toBe(shown);
  });

  test('the largest value; a percent; a percent of 0 when max is not above min', () => {
    expect(largest({ min: 6, max: 108, step: 10 })).toBe(106);
    expect(largest({ min: 0, max: 0.3, step: 0.1 })).toBe(0.3);
    expect(percent(25, { min: 0, max: 50, step: 1 })).toBe(50);
    expect(percent(10, { min: 10, max: 10, step: 1 })).toBe(0);
  });

  test('a direction gives the next value of the grid in that direction', () => {
    const grid = { min: 0, max: 100, step: 2 };
    expect(snap(25, grid, 1)).toBe(26);
    expect(snap(21, grid, -1)).toBe(20);
    expect(snap(22, grid, 1)).toBe(22);
  });

  test('the shown values are on the grid, in ascending order; the same values are the same numbers in the same order', () => {
    expect(shownValues([33, 12, 47], { min: 0, max: 100, step: 10 })).toEqual([10, 30, 50]);
    expect(shownValues(33, { min: 0, max: 100, step: 10 })).toEqual([30]);
    expect(sameValues([1, 2], [1, 2])).toBe(true);
    expect(sameValues([2, 1], [1, 2])).toBe(false);
    expect(sameValues([1], 1)).toBe(false);
    expect(sameValues(1, 1)).toBe(true);
  });
});

describe('a key or an input event', () => {
  test.each([
    { values: [50], index: 0, target: 150, result: [100] },
    { values: [50], index: 0, target: -10, result: [0] },
    { values: [20, 40, 80], index: 1, target: 50, result: [20, 50, 80] },
    { values: [20, 40, 80], index: 1, target: 90, result: [20, 80, 80] },
    { values: [20, 40, 80], index: 1, target: 10, result: [20, 20, 80] },
  ])('moves $values[$index] to $target: $result', ({ values, index, target, result }) => {
    expect(moveThumb(values, index, target, percents, 0)).toEqual(result);
  });

  test('a thumb next to a neighbour whose value is 0 stops at 0', () => {
    const grid = { min: -10, max: 10, step: 1 };
    expect(moveThumb([-10, 0], 0, 5, grid, 0)).toEqual([0, 0]);
    expect(moveThumb([0, 10], 1, -5, grid, 0)).toEqual([0, 0]);
    expect(moveThumb([-20, 0], 0, -30, { min: -50, max: 50, step: 1 }, 0)).toEqual([-30, 0]);
  });

  test('stops at the least distance; a thumb with no room in the direction of the key stays', () => {
    expect(moveThumb([20, 40], 0, 45, percents, 10)).toEqual([30, 40]);
    expect(moveThumb([20, 25], 0, 21, percents, 10)).toEqual([20, 25]);
  });
});

/** Drags `values[index]` to `target`. `disabled` lists the indexes of the disabled thumbs. */
function drag(
  behavior: ThumbCollisionBehavior,
  values: number[],
  index: number,
  target: number,
  options: { distance?: number; disabled?: number[]; grid?: Grid } = {},
) {
  return dragThumb(values, index, target, {
    grid: options.grid ?? percents,
    distance: options.distance ?? 0,
    behavior,
    disabled: values.map((_, at) => options.disabled?.includes(at) ?? false),
  });
}

describe('a drag with thumbCollisionBehavior none', () => {
  test.each([
    { values: [20, 40], index: 0, target: 70, result: [40, 40] },
    { values: [20, 40], index: 0, target: 70, distance: 5, result: [35, 40] },
    { values: [20, 40], index: 1, target: 10, result: [20, 20] },
  ])('$values[$index] to $target with a distance of $distance: $result', (row) => {
    expect(drag('none', row.values, row.index, row.target, row)).toEqual({
      values: row.result,
      index: row.index,
    });
  });

  test('does nothing when no place has the least distance', () => {
    const values = [20, 25, 30];
    expect(drag('none', values, 1, 28, { distance: 10 }).values).toBe(values);
  });
});

describe('a drag with thumbCollisionBehavior push', () => {
  test.each([
    { name: 'pushes the next thumb', values: [20, 40], index: 0, target: 65, result: [65, 65] },
    { name: 'pushes with the least distance', values: [20, 40], index: 0, target: 60, distance: 5, result: [60, 65] },
    { name: 'pushes back to min', values: [20, 40], index: 1, target: -10, result: [0, 0] },
    { name: 'pushes more than one thumb, to max at most', values: [10, 50, 90], index: 1, target: 95, distance: 5, result: [10, 95, 100] },
    { name: 'a pushed thumb stays when the drag goes back', values: [65, 65], index: 0, target: 30, result: [30, 65] },
    { name: 'a distance of a part of a step keeps values on the grid', values: [0, 1], index: 0, target: 1, distance: 1, result: [1, 2], grid: { min: 0, max: 10, step: 1 } },
    { name: 'a disabled thumb is a wall', values: [20, 40, 60], index: 0, target: 90, distance: 5, disabled: [2], result: [50, 55, 60] },
  ])('$name', (row) => {
    expect(drag('push', row.values, row.index, row.target, row)).toEqual({
      values: row.result,
      index: row.index,
    });
  });
});

describe('a drag with thumbCollisionBehavior swap', () => {
  test.each([
    { name: 'goes on with the neighbour at its value', values: [20, 40], index: 0, target: 65, result: [40, 65], next: 1 },
    { name: 'through more than one thumb', values: [20, 40, 60], index: 0, target: 80, distance: 10, result: [30, 50, 80], next: 2 },
    { name: 'down through more than one thumb', values: [20, 40, 60], index: 2, target: 10, distance: 10, result: [10, 30, 50], next: 0 },
    { name: 'stops at its limit before the value of the neighbour', values: [40, 45], index: 0, target: 44, distance: 5, result: [40, 45], next: 0 },
    { name: 'swaps at the value of the neighbour with the least distance', values: [40, 45], index: 0, target: 45, distance: 5, result: [40, 45], next: 1 },
    { name: 'swaps down at the value of the neighbour', values: [25, 40], index: 1, target: 25, distance: 5, result: [25, 30], next: 0 },
    { name: 'goes on after a swap', values: [70, 85], index: 1, target: 95, distance: 10, result: [70, 95], next: 1 },
    { name: 'does not swap with a disabled thumb', values: [20, 40], index: 0, target: 65, disabled: [1], result: [40, 40], next: 0 },
  ])('$name', (row) => {
    expect(drag('swap', row.values, row.index, row.target, row)).toEqual({
      values: row.result,
      index: row.next,
    });
  });
});

describe('the thumb of a press on the track', () => {
  test('is the enabled thumb whose value is nearest; of thumbs with one value, the first for a point below them and the last for a point above', () => {
    const enabled = [true, true, true];
    expect(nearestThumb([10, 50, 90], 60, enabled)).toBe(1);
    expect(nearestThumb([10, 50, 90], 60, [true, false, true])).toBe(2);
    expect(nearestThumb([10, 50, 50], 40, enabled)).toBe(1);
    expect(nearestThumb([10, 50, 50], 70, enabled)).toBe(2);
  });
});
