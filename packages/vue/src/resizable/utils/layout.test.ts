import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reset } from '../../common/warn';
import {
  adjustLayout,
  areLayoutsEqual,
  getHandleRange,
  hasSamePanels,
  resolveLayout,
  toRequestedLayout,
  validateLayout,
} from './layout';
import type { PanelConstraints } from './layout';

const panel = (id: string, rest: Partial<PanelConstraints> = {}): PanelConstraints => ({
  id,
  minSize: 0,
  maxSize: 100,
  defaultSize: undefined,
  ...rest,
});

describe('layout', () => {
  beforeEach(() => {
    reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial: equal shares, defaults, and a mix', () => {
    expect(resolveLayout([panel('a'), panel('b')])).toEqual({ a: 50, b: 50 });
    expect(resolveLayout([panel('a'), panel('b'), panel('c')])).toEqual({
      a: 33.334,
      b: 33.333,
      c: 33.333,
    });
    expect(resolveLayout([panel('a', { defaultSize: 30 }), panel('b'), panel('c')])).toEqual({
      a: 30,
      b: 35,
      c: 35,
    });
    expect(resolveLayout([panel('a', { defaultSize: 30 }), panel('b')], { a: 20 })).toEqual({
      a: 20,
      b: 80,
    });
  });

  it('initial: default sizes that do not sum to 100 are corrected', () => {
    expect(
      resolveLayout([panel('a', { defaultSize: 30 }), panel('b', { defaultSize: 30 })]),
    ).toEqual({ a: 70, b: 30 });
  });

  it('initial: a root with no panel has an empty layout', () => {
    expect(resolveLayout([], { a: 100 })).toEqual({});
  });

  it('initial: a panel id that an object also has is an id', () => {
    expect(resolveLayout([panel('constructor'), panel('toString')])).toEqual({
      constructor: 50,
      toString: 50,
    });
  });

  it('adjust: grows the pivot and shrinks the next panel', () => {
    const panels = [panel('a'), panel('b')];
    expect(adjustLayout(panels, { a: 50, b: 50 }, 0, 10)).toEqual({ a: 60, b: 40 });
    expect(adjustLayout(panels, { a: 50, b: 50 }, 0, -10)).toEqual({ a: 40, b: 60 });
  });

  it('adjust: the shrink goes to the next panel when the nearest is at its minimum', () => {
    const panels = [panel('a'), panel('b', { minSize: 20 }), panel('c', { minSize: 10 })];
    expect(adjustLayout(panels, { a: 40, b: 30, c: 30 }, 0, 25)).toEqual({ a: 65, b: 20, c: 15 });
    expect(adjustLayout(panels, { a: 40, b: 30, c: 30 }, 0, 100)).toEqual({ a: 70, b: 20, c: 10 });
  });

  it('adjust: the maximum of the growing panel limits the move', () => {
    const panels = [panel('a', { maxSize: 60 }), panel('b')];
    expect(adjustLayout(panels, { a: 50, b: 50 }, 0, 30)).toEqual({ a: 60, b: 40 });
  });

  it('adjust: a move that the constraints refuse gives the start layout', () => {
    const panels = [panel('a', { maxSize: 50 }), panel('b', { minSize: 50 })];
    const start = { a: 50, b: 50 };
    expect(adjustLayout(panels, start, 0, 10)).toBe(start);
    expect(adjustLayout(panels, start, 0, 0)).toBe(start);
  });

  it('adjust: a handle with no panel on one side moves nothing', () => {
    const panels = [panel('a'), panel('b')];
    const start = { a: 50, b: 50 };
    expect(adjustLayout(panels, start, -1, 10)).toBe(start);
    expect(adjustLayout(panels, start, -1, -10)).toBe(start);
    expect(adjustLayout(panels, start, 1, 10)).toBe(start);
    expect(adjustLayout(panels, start, 1, -10)).toBe(start);
  });

  it('range: the least and the greatest size of the primary panel', () => {
    const a = panel('a', { minSize: 10 });
    const b = panel('b', { minSize: 20 });
    const c = panel('c', { minSize: 10 });
    const panels = [a, b, c];
    const layout = { a: 40, b: 30, c: 30 };
    expect(getHandleRange(panels, layout, 0, a)).toEqual({ min: 10, max: 70 });
    expect(getHandleRange(panels, layout, 1, b)).toEqual({ min: 20, max: 50 });
    expect(getHandleRange(panels, layout, 1, c)).toEqual({ min: 10, max: 70 });
  });

  it('validate: sizes outside the constraints move inside, and the sum is 100', () => {
    const panels = [panel('a', { minSize: 30 }), panel('b', { maxSize: 50 }), panel('c')];
    expect(validateLayout(panels, { a: 10, b: 80, c: 10 })).toEqual({ a: 40, b: 50, c: 10 });
  });

  it('validate: constraints that cannot sum to 100 give one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const panels = [panel('a', { maxSize: 40 }), panel('b', { maxSize: 40 })];
    expect(validateLayout(panels, { a: 50, b: 50 })).toEqual({ a: 60, b: 40 });
    validateLayout(panels, { a: 50, b: 50 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^Vase UI: .*cannot sum to 100/));
  });

  it('validate: constraints that can sum to 100 give no warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateLayout([panel('a', { maxSize: 60 }), panel('b', { minSize: 40 })], { a: 50, b: 50 });
    expect(warn).not.toHaveBeenCalled();
  });

  it('fit: a new panel takes its default and the others keep their ratio', () => {
    const panels = [panel('a'), panel('b'), panel('c', { defaultSize: 20 })];
    expect(resolveLayout(panels, { a: 75, b: 25 })).toEqual({ a: 60, b: 20, c: 20 });
  });

  it('fit: the space of a removed panel goes to the others in their ratio', () => {
    expect(resolveLayout([panel('a'), panel('b')], { a: 60, b: 20, c: 20 })).toEqual({
      a: 75,
      b: 25,
    });
  });

  it('resolve: a late panel with no default takes 100 / n and the others keep their ratio', () => {
    expect(resolveLayout([panel('a'), panel('b'), panel('c')], { a: 75, b: 25 })).toEqual({
      a: 50,
      b: 16.667,
      c: 33.333,
    });
  });

  it('resolve: a panel that comes back takes the size that the requested layout still has', () => {
    const requested = { a: 60, b: 20, c: 20 };
    expect(resolveLayout([panel('a'), panel('b')], requested)).toEqual({ a: 75, b: 25 });
    expect(resolveLayout([panel('a'), panel('b'), panel('c')], requested)).toEqual(requested);
  });

  it('equal: layouts are equal when they have the same panels and sizes', () => {
    expect(areLayoutsEqual({ a: 30, b: 70 }, { b: 70, a: 30 })).toBe(true);
    expect(areLayoutsEqual({ a: 30, b: 70 }, { a: 30, b: 69.999 })).toBe(false);
    expect(areLayoutsEqual({ a: 30, b: 70 }, { a: 30, c: 70 })).toBe(false);
    expect(areLayoutsEqual({ a: 100 }, { a: 100, b: 0 })).toBe(false);
    expect(hasSamePanels({ a: 30, b: 70 }, { a: 1, b: 2 })).toBe(true);
    expect(hasSamePanels({ a: 30, b: 70 }, { a: 1, c: 2 })).toBe(false);
  });

  it('requested: a panel that is not mounted keeps its entry and the others share the rest', () => {
    expect(toRequestedLayout({ a: 80, b: 20 }, { a: 60, b: 20, c: 20 })).toEqual({
      a: 64,
      b: 16,
      c: 20,
    });
    // The panel that mounts again gets its size back.
    expect(
      resolveLayout([panel('a'), panel('b'), panel('c')], { a: 64, b: 16, c: 20 }),
    ).toEqual({ a: 64, b: 16, c: 20 });
  });

  it('requested: the shown layout stays when no entry is left over', () => {
    const shown = { a: 80, b: 20 };
    expect(toRequestedLayout(shown, { a: 60, b: 40 })).toBe(shown);
    expect(toRequestedLayout(shown, {})).toBe(shown);
  });

  it('requested: entries that leave no room for the mounted panels are forgotten', () => {
    const shown = { a: 80, b: 20 };
    expect(toRequestedLayout(shown, { c: 100 })).toBe(shown);
    expect(toRequestedLayout(shown, { c: 70, d: 40 })).toBe(shown);
  });
});
