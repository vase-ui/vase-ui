import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createGridCellMap, getGridCellIndexOfCorner } from './listIndex';
import { gridNavigation } from './root/gridNavigation';
import type { CompositeGridNavigationState } from './root/gridNavigation';

const SIZES = [
  { width: 1, height: 1 },
  { width: 3, height: 1 },
  { width: 1, height: 1 },
];

// The item fills the cell below it, so its map is different in a grid of 1 column and in a grid of
// 2 columns.
const TALL_SIZES = [{ width: 1, height: 2 }];

// A loop that does not end never returns to the event loop, so no test timeout can stop it. The
// timeout of `vm` stops the loop, and the case then fails.
function runBounded<Result>(callback: () => Result) {
  return runInNewContext('callback()', { callback }, { timeout: 250 }) as Result;
}

// The state of a key press in a grid of 3 items, with the highlight on the first item.
function pressKey(
  key: string,
  state: Partial<CompositeGridNavigationState> = {},
): CompositeGridNavigationState {
  return {
    event: { key } as KeyboardEvent,
    elementsRef: shallowRef([null, null, null]),
    highlightedIndex: 0,
    minIndex: 0,
    maxIndex: 2,
    orientation: 'both',
    loopFocus: false,
    rtl: false,
    ...state,
  };
}

describe('VUE-8: an item that is wider than the grid', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('places the item in a row of its own in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(process.env.NODE_ENV).toBe('production');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runBounded(() => createGridCellMap(SIZES, 2, false))).toEqual([0, undefined, 1, 1, 2]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('places the item in the same cells in a development build and reports it', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runBounded(() => createGridCellMap(SIZES, 2, false))).toEqual([0, undefined, 1, 1, 2]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toMatch(
      /^Vase UI: The grid item at index 1 has a width of 3 columns, and the grid has 2 columns\./,
    );
  });

  it('names a grid of 1 column in the singular when it reports the item', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runBounded(() => createGridCellMap(SIZES, 1, false))).toEqual([0, 1, 2]);
    expect(consoleError.mock.calls).toEqual([
      [
        'Vase UI: The grid item at index 1 has a width of 3 columns, and the grid has 1 column. Grid navigation cannot place an item that is wider than the grid, so it gives the item a width of 1 column. Give the item a width of at most 1, or give the grid more columns.',
      ],
    ]);
  });

  it('gives the last cell of the row as the top right corner of the item', () => {
    expect(getGridCellIndexOfCorner(1, SIZES, [0, undefined, 1, 1, 2], 2, 'tr')).toBe(3);
  });
});

describe('VUE-8: a number of columns that is not a whole number of 1 or more', () => {
  it.each([
    { cols: 0, columns: 1, cellMap: [0, 0] },
    { cols: Number.NaN, columns: 1, cellMap: [0, 0] },
    { cols: Number.POSITIVE_INFINITY, columns: 1, cellMap: [0, 0] },
    { cols: 2.5, columns: 2, cellMap: [0, undefined, 0] },
  ])('counts cols of $cols as $columns', ({ cols, cellMap }) => {
    expect(runBounded(() => createGridCellMap(TALL_SIZES, cols, false))).toEqual(cellMap);
  });

  it('moves the highlight from a disabled item when cols is 0', () => {
    const navigate = gridNavigation({ cols: 0 });

    expect(
      runBounded(() =>
        navigate(pressKey('ArrowDown', { minIndex: 1, loopFocus: true, disabledIndices: [0] })),
      ),
    ).toBe(1);
  });
});

describe('VUE-8: an item width or an item height that is not a finite number', () => {
  it.each([
    { name: 'a width of NaN', size: { width: Number.NaN, height: 1 } },
    { name: 'a height of Infinity', size: { width: 1, height: Number.POSITIVE_INFINITY } },
  ])('counts $name as 1', ({ size }) => {
    expect(runBounded(() => createGridCellMap([size], 2, false))).toEqual([0]);
  });

  it.each([
    { key: 'ArrowRight', nextIndex: 1 },
    { key: 'ArrowDown', nextIndex: 2 },
  ])('moves the highlight with $key from an item that has no finite size', ({ key, nextIndex }) => {
    const navigate = gridNavigation({
      cols: 2,
      itemSizes: [
        { width: Number.NaN, height: Number.NaN },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
      ],
    });

    expect(runBounded(() => navigate(pressKey(key)))).toBe(nextIndex);
  });
});
