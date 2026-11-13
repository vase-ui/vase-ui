import { afterEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createGridCellMap, getGridCellIndexOfCorner } from './listIndex';
import { gridNavigation } from './root/gridNavigation';

const SIZES = [
  { width: 1, height: 1 },
  { width: 3, height: 1 },
  { width: 1, height: 1 },
];

// The item fills the cell below it, so its map is different in a grid of 1 column and in a grid of
// 2 columns.
const TALL_SIZES = [{ width: 1, height: 2 }];

// A loop that does not end never returns to the event loop, so no test timeout can stop it.
// Code that does not end reads `cols` in each turn of its loops. This object throws after 1,000
// reads, so such code fails a case in milliseconds and does not hang the run.
function boundedCols(value: number) {
  let reads = 0;
  return {
    valueOf() {
      reads += 1;
      if (reads > 1000) {
        throw new Error('A loop of the grid navigation did not end.');
      }
      return value;
    },
  } as unknown as number;
}

describe('VUE-8: an item that is wider than the grid', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('places the item in a row of its own in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(process.env.NODE_ENV).toBe('production');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(createGridCellMap(SIZES, boundedCols(2), false)).toEqual([0, undefined, 1, 1, 2]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('places the item in the same cells in a development build and reports it', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(createGridCellMap(SIZES, 2, false)).toEqual([0, undefined, 1, 1, 2]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toMatch(
      /^Vase UI: The grid item at index 1 has a width of 3 columns, and the grid has 2 columns\./,
    );
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
    expect(createGridCellMap(TALL_SIZES, boundedCols(cols), false)).toEqual(cellMap);
  });

  it('moves the highlight from a disabled item when cols is 0', () => {
    const navigate = gridNavigation(() => ({ cols: boundedCols(0) }));

    expect(
      navigate({
        event: { key: 'ArrowDown' } as KeyboardEvent,
        elementsRef: shallowRef([null, null, null]),
        highlightedIndex: 0,
        minIndex: 1,
        maxIndex: 2,
        orientation: 'both',
        loopFocus: true,
        disabledIndices: [0],
        rtl: false,
      }),
    ).toBe(1);
  });
});
