import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGridCellMap, getGridCellIndexOfCorner } from './listIndex';

const SIZES = [
  { width: 1, height: 1 },
  { width: 3, height: 1 },
  { width: 1, height: 1 },
];

describe('VUE-8: an item that is wider than the grid', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('places the item in a row of its own in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(process.env.NODE_ENV).toBe('production');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A loop that does not end never returns to the event loop, so no test timeout can stop it.
    // Each turn of the loop reads `cols`. This object throws after 1,000 reads, so a loop that
    // does not end fails the case in milliseconds and does not hang the run.
    let reads = 0;
    const cols = {
      valueOf() {
        reads += 1;
        if (reads > 1000) {
          throw new Error('The loop of createGridCellMap did not end.');
        }
        return 2;
      },
    } as unknown as number;

    expect(createGridCellMap(SIZES, cols, false)).toEqual([0, undefined, 1, 1, 2]);
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
