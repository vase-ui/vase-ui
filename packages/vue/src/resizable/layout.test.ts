import { describe, expect, it } from 'vitest';
import {
  isLength,
  isViewportLength,
  normalizeLayout,
  parsePixels,
  parseSize,
  toEventLayout,
  adjustLayout,
  adjustLayoutToSize,
  areConstraintsFeasible,
  areLayoutsEqual,
  getHandleLimits,
  getHandleRange,
  hasSamePanels,
  isCollapsed,
  resolveLayout,
  resolveSize,
  snapDelta,
  takePins,
  toRequestedLayout,
  applyFixedSizes,
  validateLayout,
} from './layout';
import type { Layout, Measurement, PanelConstraints } from './layout';

const panel = (id: string, rest: Partial<PanelConstraints> = {}): PanelConstraints => ({
  id,
  minSize: 0,
  maxSize: 100,
  collapsible: false,
  collapsedSize: 0,
  defaultSize: undefined,
  ...rest,
});

describe('layout', () => {
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

  it.each([{ id: 'constructor' }, { id: 'toString' }, { id: '__proto__' }])(
    'initial: a panel id that an object also has, $id, is an id',
    ({ id }) => {
      const layout = resolveLayout([panel(id), panel('b')]);

      expect(Object.keys(layout)).toEqual([id, 'b']);
      expect(Object.values(layout)).toEqual([50, 50]);
      // The requested layout does not name the panel, so the panel takes the space that is left.
      expect(Object.values(resolveLayout([panel(id), panel('b')], { b: 30 }))).toEqual([70, 30]);
      expect(hasSamePanels({ [id]: 50, b: 50 }, { b: 50, c: 50 })).toBe(false);
      expect(toRequestedLayout({ a: 50, b: 50 }, { [id]: 20, a: 40, b: 40 })).toEqual({
        [id]: 20,
        a: 40,
        b: 40,
      });
    },
  );

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

  it('adjust: a delta that is not a finite number moves nothing', () => {
    const panels = [panel('a'), panel('b')];
    const start = { a: 50, b: 50 };
    expect(adjustLayout(panels, start, 0, Number.NaN)).toBe(start);
    expect(adjustLayout(panels, start, 0, Number.POSITIVE_INFINITY)).toBe(start);
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

  it('validate: constraints that cannot sum to 100 give the sizes that come nearest', () => {
    const panels = [panel('a', { maxSize: 40 }), panel('b', { maxSize: 40 })];
    expect(validateLayout(panels, { a: 50, b: 50 })).toEqual({ a: 60, b: 40 });
  });

  it('feasible: the minimum sizes and the maximum sizes allow a layout that sums to 100', () => {
    expect(areConstraintsFeasible([panel('a', { maxSize: 60 }), panel('b', { minSize: 40 })])).toBe(
      true,
    );
    expect(areConstraintsFeasible([panel('a', { minSize: 100 })])).toBe(true);
    expect(areConstraintsFeasible([])).toBe(true);
    expect(areConstraintsFeasible([panel('a', { maxSize: 40 }), panel('b', { maxSize: 40 })])).toBe(
      false,
    );
    expect(areConstraintsFeasible([panel('a', { minSize: 60 }), panel('b', { minSize: 60 })])).toBe(
      false,
    );
    // The sums allow 100, but no size of the first panel is inside its constraints.
    expect(areConstraintsFeasible([panel('a', { minSize: 60, maxSize: 40 }), panel('b')])).toBe(
      false,
    );
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
    expect(resolveLayout([panel('a'), panel('b'), panel('c')], { a: 64, b: 16, c: 20 })).toEqual({
      a: 64,
      b: 16,
      c: 20,
    });
  });

  it('requested: the layout sums to 100 after the rounding of each entry', () => {
    const requested = toRequestedLayout({ a: 50, b: 50 }, { a: 33.334, b: 33.333, c: 33.333 });

    expect(Object.values(requested).reduce((total, size) => total + size, 0)).toBe(100);
    expect(requested.c).toBe(33.333);
  });

  it('requested: a panel that is not mounted keeps its exact size when the rounding has an error', () => {
    // 30% of 12.345 and of 87.655 round to 3.704 and 26.297, which sum to 30.001.
    const requested = toRequestedLayout({ a: 12.345, b: 87.655 }, { a: 10, b: 20, c: 70 });

    expect(requested).toEqual({ a: 3.704, b: 26.296, c: 70 });
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

  it.each([
    { name: 'a shrink to 21 gives the least size', wanted: 21, direction: 'shrink', size: 25 },
    { name: 'a shrink to 19 collapses', wanted: 19, direction: 'shrink', size: 5 },
    { name: 'a grow to 9 stays collapsed', wanted: 9, direction: 'grow', size: 5 },
    { name: 'a grow to 11 expands', wanted: 11, direction: 'grow', size: 25 },
  ] as const)(
    'threshold: a threshold of 5 replaces the half of the distance, $name',
    ({ wanted, direction, size }) => {
      // The collapsed size is 5 and the least size is 25: the panel collapses below 20 and expands
      // above 10.
      const a = panel('a', {
        minSize: 25,
        collapsible: true,
        collapsedSize: 5,
        collapseThreshold: 5,
      });

      expect(resolveSize(a, wanted, direction)).toBe(size);
    },
  );

  it.each([
    { name: 'a shrink to 11', wanted: 11, direction: 'shrink', size: 20 },
    { name: 'a shrink to 10', wanted: 10, direction: 'shrink', size: 10 },
    { name: 'a grow to 19', wanted: 19, direction: 'grow', size: 10 },
    { name: 'a grow to 20', wanted: 20, direction: 'grow', size: 20 },
  ] as const)(
    'threshold: a threshold greater than the distance acts as the distance, $name',
    ({ wanted, direction, size }) => {
      const a = panel('a', {
        minSize: 20,
        collapsible: true,
        collapsedSize: 10,
        collapseThreshold: 50,
      });

      expect(resolveSize(a, wanted, direction)).toBe(size);
    },
  );

  it.each([
    { name: 'a shrink to 24', wanted: 24, direction: 'shrink', size: 5 },
    { name: 'a grow to 6', wanted: 6, direction: 'grow', size: 25 },
  ] as const)('threshold: an exact move ignores it, $name', ({ wanted, direction, size }) => {
    const a = panel('a', {
      minSize: 25,
      collapsible: true,
      collapsedSize: 5,
      collapseThreshold: 5,
    });

    expect(resolveSize(a, wanted, direction, true)).toBe(size);
  });

  it('threshold: a panel that is not collapsible stops at its least size', () => {
    expect(resolveSize(panel('a', { minSize: 25, collapsedSize: 5 }), 3, 'shrink')).toBe(25);
    expect(resolveSize(panel('a', { minSize: 25, collapsedSize: 5 }), 3, 'shrink', true)).toBe(25);
  });

  it.each([
    { name: 'to the least size', delta: -10, a: 20 },
    { name: 'to the least size at the edge', delta: -17, a: 20 },
    { name: 'to the collapsed size', delta: -19, a: 4 },
  ])('adjust: a collapsible panel collapses after half of the distance, $name', ({ delta, a }) => {
    const panels = [panel('a', { minSize: 20, collapsible: true, collapsedSize: 4 }), panel('b')];

    expect(adjustLayout(panels, { a: 30, b: 70 }, 0, delta)).toEqual({ a, b: 100 - a });
  });

  it.each([
    { name: 'stays collapsed below half', delta: 7, a: 4 },
    { name: 'expands above half', delta: 9, a: 20 },
    { name: 'goes on past the least size', delta: 30, a: 34 },
  ])('adjust: a collapsed panel expands after half of the distance, $name', ({ delta, a }) => {
    const panels = [panel('a', { minSize: 20, collapsible: true, collapsedSize: 4 }), panel('b')];
    const start = { a: 4, b: 96 };

    const next = adjustLayout(panels, start, 0, delta);

    expect(next).toEqual({ a, b: 100 - a });
    if (a === 4) {
      expect(next).toBe(start);
    }
  });

  it('adjust: with `exact` a key step collapses and expands at once', () => {
    const panels = [panel('a', { minSize: 20, collapsible: true }), panel('b')];

    expect(adjustLayout(panels, { a: 20, b: 80 }, 0, -1, { exact: true })).toEqual({
      a: 0,
      b: 100,
    });
    expect(adjustLayout(panels, { a: 0, b: 100 }, 0, 1, { exact: true })).toEqual({ a: 20, b: 80 });
  });

  it.each([
    { name: 'a panel with room takes the collapse', max: 100, expected: { a: 0, b: 90, c: 10 } },
    { name: 'a panel with no room refuses it', max: 85, expected: { a: 20, b: 70, c: 10 } },
  ])(
    'adjust: a collapse that the growing panel has no room for is refused, $name',
    ({ max, expected }) => {
      const panels = [
        panel('a', { minSize: 20, collapsible: true }),
        panel('b', { maxSize: max }),
        panel('c'),
      ];

      expect(adjustLayout(panels, { a: 30, b: 60, c: 10 }, 0, -25)).toEqual(expected);
    },
  );

  it('adjust: a panel does not grow to a size between its collapsed size and its least size', () => {
    const panels = [
      panel('a', { minSize: 20, collapsible: true, collapsedSize: 4 }),
      panel('b', { minSize: 85 }),
    ];
    const start = { a: 4, b: 96 };

    expect(adjustLayout(panels, start, 0, 30)).toBe(start);
  });

  // In each case, a sum of sizes with decimals misses a limit by a rounding error of floating point:
  // 0.2 + (99.8 - 98) is less than 2, and 10.4 + 59.7 is more than 70.1.
  it.each<{
    name: string;
    panels: PanelConstraints[];
    start: Layout;
    delta: number;
    expected: Layout;
  }>([
    {
      name: 'an expand from a collapsed size of 0.2',
      panels: [panel('a', { minSize: 2, collapsible: true, collapsedSize: 0.2 }), panel('b')],
      start: { a: 0.2, b: 99.8 },
      delta: 1,
      expected: { a: 2, b: 98 },
    },
    {
      name: 'a collapse that fills a maximum of 70.1',
      panels: [
        panel('a', { minSize: 20, collapsible: true }),
        panel('b', { maxSize: 70.1 }),
        panel('c'),
      ],
      start: { a: 59.7, b: 10.4, c: 29.9 },
      delta: -100,
      expected: { a: 0, b: 70.1, c: 29.9 },
    },
    {
      name: 'a step to a least size of 33.29',
      panels: [panel('a', { minSize: 33.29, collapsible: true }), panel('b')],
      start: { a: 35.22, b: 64.78 },
      delta: -1.93,
      expected: { a: 33.29, b: 66.71 },
    },
  ])(
    'adjust: a rounding error of a sum does not change $name',
    ({ panels, start, delta, expected }) => {
      expect(adjustLayout(panels, start, 0, delta, { exact: true })).toEqual(expected);
    },
  );

  it.each([
    {
      name: 'the handle before it, to the right',
      pivot: 0,
      delta: 10,
      expected: { a: 40, b: 30, c: 30 },
    },
    {
      name: 'the handle before it, to the left',
      pivot: 0,
      delta: -10,
      expected: { a: 20, b: 30, c: 50 },
    },
    {
      name: 'the handle after it, to the right',
      pivot: 1,
      delta: 10,
      expected: { a: 40, b: 30, c: 30 },
    },
    {
      name: 'the handle after it, to the left',
      pivot: 1,
      delta: -10,
      expected: { a: 20, b: 30, c: 50 },
    },
  ])('locked: a move goes through a disabled panel, $name', ({ pivot, delta, expected }) => {
    const panels = [panel('a'), panel('b', { locked: true }), panel('c')];

    expect(adjustLayout(panels, { a: 30, b: 30, c: 40 }, pivot, delta)).toEqual(expected);
  });

  it('locked: a handle with only locked panels on one side moves nothing', () => {
    const a = panel('a', { locked: true });
    const panels = [a, panel('b'), panel('c')];
    const start = { a: 30, b: 30, c: 40 };

    expect(adjustLayout(panels, start, 0, 10)).toBe(start);
    expect(adjustLayout(panels, start, 0, -10)).toBe(start);
    expect(getHandleRange(panels, start, 0, a)).toEqual({ min: 30, max: 30 });
    expect(adjustLayout(panels, start, 1, 10)).toEqual({ a: 30, b: 40, c: 30 });
  });

  it('locked: a disabled panel keeps its constraints in a layout that is validated', () => {
    const panels = [panel('a', { locked: true, minSize: 10 }), panel('b')];

    expect(resolveLayout(panels, { a: 5, b: 95 })).toEqual({ a: 10, b: 90 });
  });

  it('push: with `push: false` only the two panels beside the handle change', () => {
    const panels = [panel('a'), panel('b', { minSize: 20 }), panel('c')];
    const start = { a: 30, b: 30, c: 40 };

    expect(adjustLayout(panels, start, 0, 30)).toEqual({ a: 60, b: 20, c: 20 });
    expect(adjustLayout(panels, start, 0, 30, { push: false })).toEqual({ a: 40, b: 20, c: 40 });
    expect(adjustLayout(panels, start, 1, -30, { push: false })).toEqual({ a: 30, b: 20, c: 50 });
  });

  it('push: with `push: false` a locked panel beside the handle stops the move', () => {
    const panels = [panel('a'), panel('b', { locked: true }), panel('c')];
    const start = { a: 30, b: 30, c: 40 };

    expect(adjustLayout(panels, start, 0, 10, { push: false })).toBe(start);
    expect(adjustLayout(panels, start, 0, -10, { push: false })).toBe(start);
  });

  it('range: a collapsible panel can go to its collapsed size, and push: false limits the greatest size', () => {
    const a = panel('a', { minSize: 20, collapsible: true, collapsedSize: 4 });
    const panels = [a, panel('b', { minSize: 30 }), panel('c')];
    const layout = { a: 30, b: 30, c: 40 };

    expect(getHandleRange(panels, layout, 0, a)).toEqual({ min: 4, max: 70 });
    expect(getHandleRange(panels, layout, 0, a, false)).toEqual({ min: 4, max: 30 });
  });

  it('range: a collapsible panel just above its least size can go to its collapsed size', () => {
    // The panel after the handle has 20.002 of room, which is all of the size of the first panel
    // above its collapsed size. The sizes have decimals, as a layout has after a drag.
    const a = panel('a', { minSize: 20, collapsible: true, collapseThreshold: 20 });
    const panels = [a, panel('b')];
    const layout = { a: 20.002, b: 79.998 };

    expect(getHandleRange(panels, layout, 0, a)).toEqual({ min: 0, max: 100 });
    expect(adjustLayout(panels, layout, 0, -100, { exact: true })).toEqual({ a: 0, b: 100 });
  });

  it.each([
    {
      name: 'at the least size',
      layout: { a: 20, b: 80 },
      expected: { atMin: true, atMax: false },
    },
    { name: 'between', layout: { a: 40, b: 60 }, expected: { atMin: false, atMax: false } },
    {
      name: 'at the greatest size',
      layout: { a: 60, b: 40 },
      expected: { atMin: false, atMax: true },
    },
  ])('limits: the handle is $name', ({ layout, expected }) => {
    const panels = [panel('a', { minSize: 20, maxSize: 60 }), panel('b', { minSize: 30 })];

    expect(getHandleLimits(panels, layout, 0)).toEqual(expected);
  });

  it('limits: a collapsible panel at its least size is not at the end of the travel', () => {
    const panels = [panel('a', { minSize: 20, collapsible: true }), panel('b')];

    expect(getHandleLimits(panels, { a: 20, b: 80 }, 0)).toEqual({ atMin: false, atMax: false });
    expect(getHandleLimits(panels, { a: 0, b: 100 }, 0)).toEqual({ atMin: true, atMax: false });
  });

  it('limits: a handle with only locked panels on one side is at both ends', () => {
    const panels = [panel('a', { locked: true }), panel('b'), panel('c')];

    expect(getHandleLimits(panels, { a: 30, b: 30, c: 40 }, 0)).toEqual({
      atMin: true,
      atMax: true,
    });
  });

  it('limits: with `push: false` the panels beyond the next panel do not count', () => {
    const panels = [panel('a'), panel('b', { minSize: 30 }), panel('c')];
    const layout = { a: 30, b: 30, c: 40 };

    expect(getHandleLimits(panels, layout, 0)).toEqual({ atMin: false, atMax: false });
    expect(getHandleLimits(panels, layout, 0, false)).toEqual({ atMin: false, atMax: true });
  });

  it('collapsed: a collapsible panel at its collapsed size is collapsed', () => {
    const a = panel('a', { minSize: 20, collapsible: true, collapsedSize: 33.3333 });

    expect(isCollapsed(a, 33.333)).toBe(false);
    expect(isCollapsed({ ...a, minSize: 40 }, 33.333)).toBe(true);
    expect(isCollapsed(a, 20)).toBe(false);
    expect(isCollapsed(panel('b', { minSize: 20, collapsedSize: 4 }), 4)).toBe(false);
  });

  it('validate: a collapsed panel takes none of the remainder', () => {
    const panels = [panel('a', { minSize: 20, collapsible: true }), panel('b'), panel('c')];

    expect(validateLayout(panels, { a: 5, b: 50, c: 40 })).toEqual({ a: 0, b: 60, c: 40 });
  });

  it('initial: a default size that is the collapsed size gives a collapsed panel', () => {
    const a = (collapsedSize: number) =>
      panel('a', { minSize: 20, collapsible: true, collapsedSize, defaultSize: collapsedSize });

    expect(resolveLayout([a(0), panel('b')])).toEqual({ a: 0, b: 100 });
    expect(resolveLayout([a(4), panel('b')])).toEqual({ a: 4, b: 96 });
  });

  it('action: `expand()` does not collapse another panel', () => {
    const panels = [
      panel('nav', { minSize: 20, collapsible: true }),
      panel('editor', { minSize: 30 }),
      panel('preview', { minSize: 20, collapsible: true }),
    ];
    const start = { nav: 0, editor: 35, preview: 65 };

    // A key can collapse the preview. An action takes only what the preview has above its least size.
    expect(adjustLayout(panels, start, 0, 60, { exact: true })).toEqual({
      nav: 70,
      editor: 30,
      preview: 0,
    });
    expect(adjustLayout(panels, start, 0, 60, { exact: true, only: -1 })).toEqual({
      nav: 50,
      editor: 30,
      preview: 20,
    });
    // `collapse()` names the panel that collapses.
    expect(
      adjustLayout(panels, { nav: 30, editor: 30, preview: 40 }, 0, -30, { exact: true, only: 0 }),
    ).toEqual({ nav: 0, editor: 60, preview: 40 });
  });

  it.each([
    {
      name: 'the panel before the handle',
      pivot: 0,
      index: 0,
      size: 20,
      expected: { a: 20, b: 80 },
    },
    {
      name: 'the panel after the handle',
      pivot: 0,
      index: 1,
      size: 70,
      expected: { a: 30, b: 70 },
    },
  ])('to size: a panel takes a size with $name', ({ pivot, index, size, expected }) => {
    const panels = [panel('a'), panel('b')];

    expect(adjustLayoutToSize(panels, { a: 50, b: 50 }, pivot, index, size)).toEqual(expected);
  });

  it('to size: the move is exact, so a collapsible panel collapses at once', () => {
    const panels = [panel('a', { minSize: 20, collapsible: true }), panel('b')];

    expect(adjustLayoutToSize(panels, { a: 50, b: 50 }, 0, 0, 5)).toEqual({ a: 0, b: 100 });
    expect(adjustLayoutToSize(panels, { a: 50, b: 50 }, 0, 0, 5, { only: 0 })).toEqual({
      a: 0,
      b: 100,
    });
    expect(adjustLayoutToSize(panels, { a: 50, b: 50 }, 0, 0, 5, { only: 1 })).toEqual({
      a: 20,
      b: 80,
    });
  });

  describe('fixed panels', () => {
    const layout = { nav: 20, editor: 50, preview: 30 };

    it('fixed: a fixed panel keeps its pixels when the root changes size', () => {
      const panels = [panel('nav', { fixed: true }), panel('editor'), panel('preview')];
      const pins = takePins(panels, layout, 1000);

      expect(pins).toEqual({ nav: 200 });
      expect(applyFixedSizes(panels, layout, pins, 2000)).toEqual({
        nav: 10,
        editor: 56.25,
        preview: 33.75,
      });
      expect(applyFixedSizes(panels, layout, pins, 500)).toEqual({
        nav: 40,
        editor: 37.5,
        preview: 22.5,
      });
      expect(applyFixedSizes(panels, layout, pins, 1000)).toEqual(layout);
    });

    it('fixed: the constraints of the other panels limit a fixed panel in a small root', () => {
      const panels = [
        panel('nav', { fixed: true }),
        panel('editor', { minSize: 30 }),
        panel('preview', { minSize: 30 }),
      ];

      expect(applyFixedSizes(panels, layout, { nav: 200 }, 250)).toEqual({
        nav: 40,
        editor: 30,
        preview: 30,
      });
      expect(applyFixedSizes(panels, layout, { nav: 200 }, 150)).toEqual({
        nav: 40,
        editor: 30,
        preview: 30,
      });
    });

    it('fixed: the other panels take the room before a fixed panel does', () => {
      // At 2000 px the pin of 200 px is 10%. The preview has 20% at most, and the editor takes the
      // rest of the share of the preview, so the nav stays at its pin.
      const panels = [
        panel('nav', { fixed: true }),
        panel('editor', { maxSize: 80 }),
        panel('preview', { maxSize: 20 }),
      ];

      expect(applyFixedSizes(panels, layout, { nav: 200 }, 2000)).toEqual({
        nav: 10,
        editor: 70,
        preview: 20,
      });
    });

    it('fixed: the fixed panels take the room that the other panels cannot take', () => {
      const panels = [
        panel('nav', { fixed: true }),
        panel('editor', { maxSize: 60 }),
        panel('preview', { maxSize: 20 }),
      ];

      // Both other panels are at their greatest size, so the nav grows from 10% to 20%.
      expect(applyFixedSizes(panels, layout, { nav: 200 }, 2000)).toEqual({
        nav: 20,
        editor: 60,
        preview: 20,
      });
    });

    it('fixed: a greatest size and a least size both hold, one after the other', () => {
      const panels = [
        panel('nav', { fixed: true }),
        panel('a', { maxSize: 20 }),
        panel('b', { minSize: 35 }),
        panel('c'),
      ];

      // The share of the other panels is 90%, and each would have 30%. The panel `a` is above its
      // greatest size by more than `b` is below its least size, so `a` holds at 20 first. The panels
      // `b` and `c` then share 70% and have 35% each, which is the least size of `b`.
      expect(applyFixedSizes(panels, { nav: 10, a: 30, b: 30, c: 30 }, { nav: 100 }, 1000)).toEqual(
        { nav: 10, a: 20, b: 35, c: 35 },
      );
      // Two panels that a least size holds have that size, and the others share what is left.
      expect(
        applyFixedSizes(
          [
            panel('nav', { fixed: true }),
            panel('a', { minSize: 40 }),
            panel('b'),
            panel('c', { minSize: 40 }),
          ],
          { nav: 10, a: 30, b: 30, c: 30 },
          { nav: 100 },
          1000,
        ),
      ).toEqual({ nav: 10, a: 40, b: 10, c: 40 });
    });

    it.each<{
      name: string;
      panels: PanelConstraints[];
      layout: Layout;
      pins: Record<string, number>;
      space: number;
    }>([
      {
        name: 'no other panel',
        panels: [panel('a', { fixed: true }), panel('b', { fixed: true })],
        layout: { a: 40, b: 60 },
        pins: { a: 400, b: 600 },
        space: 2000,
      },
      {
        name: 'no pin',
        panels: [panel('a', { fixed: true }), panel('b')],
        layout: { a: 40, b: 60 },
        pins: {},
        space: 2000,
      },
      {
        name: 'no fixed panel',
        panels: [panel('a'), panel('b')],
        layout: { a: 40, b: 60 },
        pins: { a: 400 },
        space: 2000,
      },
      {
        name: 'no space',
        panels: [panel('a', { fixed: true }), panel('b')],
        layout: { a: 40, b: 60 },
        pins: { a: 400 },
        space: 0,
      },
    ])('fixed: the layout stays with $name', ({ panels, layout: start, pins, space }) => {
      expect(applyFixedSizes(panels, start, pins, space)).toBe(start);
    });

    it('fixed: a collapsed panel stays collapsed', () => {
      const panels = [
        panel('nav', { fixed: true, minSize: 20, collapsible: true, collapsedSize: 5 }),
        panel('editor'),
      ];
      const collapsed = { nav: 5, editor: 95 };

      expect(applyFixedSizes(panels, collapsed, takePins(panels, collapsed, 1000), 2000)).toEqual(
        collapsed,
      );
      // A collapsed panel that is not fixed stays collapsed too.
      const others = [
        panel('nav', { fixed: true }),
        panel('side', { minSize: 20, collapsible: true }),
        panel('main'),
      ];
      expect(applyFixedSizes(others, { nav: 40, side: 0, main: 60 }, { nav: 400 }, 2000)).toEqual({
        nav: 20,
        side: 0,
        main: 80,
      });
    });

    it.each([{ id: 'constructor' }, { id: 'toString' }, { id: '__proto__' }])(
      'fixed: the id $id is an id of a fixed panel',
      ({ id }) => {
        const panels = [panel(id, { fixed: true }), panel('other')];
        const start = { [id]: 20, other: 80 };

        expect(Object.entries(takePins(panels, start, 1000))).toEqual([[id, 200]]);
        expect(Object.entries(applyFixedSizes(panels, start, { [id]: 200 }, 2000))).toEqual([
          [id, 10],
          ['other', 90],
        ]);
        expect(applyFixedSizes(panels, start, {}, 2000)).toBe(start);
      },
    );

    it.each([{ id: 'constructor' }, { id: 'toString' }, { id: '__proto__' }])(
      'fixed: the id $id is an id of a panel that shares the room',
      ({ id }) => {
        const panels = [panel('nav', { fixed: true }), panel(id), panel('other')];
        const start = { nav: 20, [id]: 50, other: 30 };

        expect(Object.entries(applyFixedSizes(panels, start, { nav: 200 }, 2000))).toEqual([
          ['nav', 10],
          [id, 56.25],
          ['other', 33.75],
        ]);
      },
    );

    it('priority: the fixed panel with the greater number gives way first', () => {
      const start = { nav: 30, editor: 40, aside: 30 };
      const pins = { nav: 300, aside: 300 };
      const inSequence = [
        panel('nav', { fixed: true, minSize: 10 }),
        panel('editor', { minSize: 40 }),
        panel('aside', { fixed: true, minSize: 10 }),
      ];
      const asideFirst = [
        panel('nav', { fixed: true, minSize: 10 }),
        panel('editor', { minSize: 40 }),
        panel('aside', { fixed: true, minSize: 10, priority: 1 }),
      ];

      // At 800 px each pin is 37.5%, and the editor has 25%, which is less than its least size.
      expect(applyFixedSizes(inSequence, start, pins, 800)).toEqual({
        nav: 22.5,
        editor: 40,
        aside: 37.5,
      });
      expect(applyFixedSizes(asideFirst, start, pins, 800)).toEqual({
        nav: 37.5,
        editor: 40,
        aside: 22.5,
      });
    });

    it('priority: a fixed panel that reached its least size lets the next one give way', () => {
      const panels = [
        panel('nav', { fixed: true, minSize: 35, priority: 1 }),
        panel('editor', { minSize: 40 }),
        panel('aside', { fixed: true, minSize: 10 }),
      ];

      expect(
        applyFixedSizes(panels, { nav: 30, editor: 40, aside: 30 }, { nav: 300, aside: 300 }, 800),
      ).toEqual({ nav: 35, editor: 40, aside: 25 });
    });
  });

  describe('snapping', () => {
    it('snap: a drag step moves the handle in steps', () => {
      const panels = [panel('a'), panel('b')];
      const start = { a: 50, b: 50 };

      expect(snapDelta(panels, start, 0, 7, 5)).toBe(5);
      expect(snapDelta(panels, start, 0, 8, 5)).toBe(10);
      expect(snapDelta(panels, start, 0, -8, 5)).toBe(-10);
      expect(snapDelta(panels, start, 0, 7.3)).toBe(7.3);
      expect(snapDelta(panels, start, 0, 7.3, 0)).toBe(7.3);
    });

    it('snap: a snap point gives its size inside the tolerance', () => {
      const panels = [
        panel('a', { snapPoints: [25, 40], snapTolerance: 2 }),
        panel('b', { snapPoints: [50], snapTolerance: 2 }),
      ];
      const start = { a: 30, b: 70 };

      expect(snapDelta(panels, start, 0, 9)).toBe(10);
      expect(snapDelta(panels, start, 0, 11.5)).toBe(10);
      expect(snapDelta(panels, start, 0, 13)).toBe(13);
      expect(snapDelta(panels, start, 0, -4)).toBe(-5);
      // The panel after the handle: 70 - 19 = 51, which is inside the tolerance of 50.
      expect(snapDelta(panels, start, 0, 19)).toBe(20);
      expect(adjustLayout(panels, start, 0, snapDelta(panels, start, 0, 9))).toEqual({
        a: 40,
        b: 60,
      });
    });

    it('snap: a point has no tolerance by default, and the nearest point wins', () => {
      const start = { a: 30, b: 70 };

      expect(snapDelta([panel('a', { snapPoints: [40, 44] }), panel('b')], start, 0, 9.9)).toBe(
        9.9,
      );
      expect(
        snapDelta(
          [panel('a', { snapPoints: [40, 44], snapTolerance: 5 }), panel('b')],
          start,
          0,
          13,
        ),
      ).toBe(14);
    });

    it('snap: the drag step comes first, and the point takes the stepped size', () => {
      const panels = [panel('a', { snapPoints: [38], snapTolerance: 3 }), panel('b')];

      // 7 gives a step of 5, so the panel has 35, which is inside the tolerance of 38.
      expect(snapDelta(panels, { a: 30, b: 70 }, 0, 7, 5)).toBe(8);
    });

    it('snap: a point outside the least and the greatest size is not used', () => {
      const panels = [
        panel('a', { minSize: 20, maxSize: 60, snapPoints: [10, 70, 30], snapTolerance: 100 }),
        panel('b'),
      ];

      // The panel would have 65. Its nearest point is 70, which is above its greatest size, so the
      // point 30 wins.
      expect(snapDelta(panels, { a: 40, b: 60 }, 0, 25)).toBe(-10);
    });

    it('snap: a locked panel does not snap', () => {
      const panels = [panel('a', { locked: true, snapPoints: [40], snapTolerance: 5 }), panel('b')];

      expect(snapDelta(panels, { a: 30, b: 70 }, 0, 9)).toBe(9);
    });
  });
});

// One percent of the panel space is 10 px, and 1% of the viewport is 12 px by 8 px.
const measurement: Measurement = {
  space: 1000,
  rem: 16,
  em: 20,
  viewportWidth: 1200,
  viewportHeight: 800,
};

describe('sizes', () => {
describe('parseSize', () => {
  it.each([
    { name: 'a number', value: 25, expected: 25 },
    { name: 'a decimal number', value: 12.5, expected: 12.5 },
    { name: 'a string of a number', value: '25', expected: 25 },
    { name: 'a string with a percent sign', value: '25%', expected: 25 },
    { name: 'a decimal string', value: '12.5%', expected: 12.5 },
    { name: 'a string that starts with a point', value: '.5', expected: 0.5 },
    { name: 'a string with spaces around it', value: ' 25% ', expected: 25 },
    { name: 'zero', value: 0, expected: 0 },
  ])('gives the percent of $name, with no measurement', ({ value, expected }) => {
    expect(parseSize(value, undefined)).toBe(expected);
    expect(parseSize(value, measurement)).toBe(expected);
  });

  it.each([
    { name: 'pixels', value: '200px', expected: 20 },
    { name: 'a decimal number of pixels', value: '12.5px', expected: 1.25 },
    { name: 'em', value: '10em', expected: 20 },
    { name: 'rem', value: '10rem', expected: 16 },
    { name: 'vw', value: '50vw', expected: 60 },
    { name: 'vh', value: '25vh', expected: 20 },
    { name: 'a length with spaces around it', value: ' 200px ', expected: 20 },
  ])('gives the percent of the panel space for a length in $name', ({ value, expected }) => {
    expect(parseSize(value, measurement)).toBeCloseTo(expected, 10);
  });

  it.each([
    { name: 'pixels', value: '200px' },
    { name: 'em', value: '10em' },
    { name: 'rem', value: '10rem' },
    { name: 'vw', value: '50vw' },
    { name: 'vh', value: '25vh' },
  ])('gives nothing for a length in $name while there is no measurement', ({ value }) => {
    expect(parseSize(value, undefined)).toBeUndefined();
  });

  it.each([
    { name: 'a unit that is not known', value: '12ch' },
    { name: 'text', value: 'wide' },
    { name: 'an empty string', value: '' },
    { name: 'a percent sign alone', value: '%' },
    { name: 'a unit alone', value: 'px' },
    { name: 'a space before the percent sign', value: '25 %' },
    { name: 'a space before the unit', value: '25 px' },
    { name: 'a unit in capital letters', value: '25PX' },
    { name: 'a number that is not finite', value: Number.NaN },
    { name: 'infinity', value: Number.POSITIVE_INFINITY },
    { name: 'a negative number', value: -10 },
    { name: 'a negative string', value: '-10%' },
    { name: 'a negative length', value: '-10px' },
  ])('gives nothing for $name', ({ value }) => {
    expect(parseSize(value, measurement)).toBeUndefined();
    expect(parseSize(value, undefined)).toBeUndefined();
    expect(parsePixels(value, measurement)).toBeUndefined();
  });
});

describe('parsePixels', () => {
  it.each([
    { name: 'pixels', value: '200px', expected: 200 },
    { name: 'em', value: '10em', expected: 200 },
    { name: 'rem', value: '10rem', expected: 160 },
    { name: 'vw', value: '50vw', expected: 600 },
    { name: 'vh', value: '25vh', expected: 200 },
    { name: 'a number, which is percent', value: 25, expected: 250 },
    { name: 'a string with a percent sign', value: '25%', expected: 250 },
  ])('gives the pixels for a size in $name', ({ value, expected }) => {
    expect(parsePixels(value, measurement)).toBe(expected);
  });

  it('gives nothing while there is no measurement', () => {
    expect(parsePixels('200px', undefined)).toBeUndefined();
    expect(parsePixels(25, undefined)).toBeUndefined();
  });
});

describe('isLength and isViewportLength', () => {
  it.each([
    { name: 'a number', value: 25, length: false, viewport: false },
    { name: 'a percent', value: '25%', length: false, viewport: false },
    { name: 'no size', value: undefined, length: false, viewport: false },
    { name: 'pixels', value: '25px', length: true, viewport: false },
    { name: 'em', value: '25em', length: true, viewport: false },
    { name: 'rem', value: '25rem', length: true, viewport: false },
    { name: 'vw', value: '25vw', length: true, viewport: true },
    { name: 'vh', value: '25vh', length: true, viewport: true },
  ])('tells a length from a percent for $name', ({ value, length, viewport }) => {
    expect(isLength(value)).toBe(length);
    expect(isViewportLength(value)).toBe(viewport);
  });
});

describe('normalizeLayout', () => {
  const basis = () => measurement;

  it('gives percent for each entry, and the pixels of a fixed panel that has a length', () => {
    expect(
      normalizeLayout(
        { nav: '200px', side: '300px', main: 50, rest: '30%' },
        new Set(['nav']),
        basis,
      ),
    ).toEqual({
      layout: { nav: 20, side: 30, main: 50, rest: 30 },
      pins: { nav: 200 },
      lengths: new Set(['nav', 'side']),
    });
  });

  it('gives no pixels for a fixed panel that has a percent', () => {
    expect(normalizeLayout({ nav: '20%' }, new Set(['nav']), basis)).toEqual({
      layout: { nav: 20 },
      pins: {},
      lengths: new Set(),
    });
  });

  it('leaves out a length while there is no measurement', () => {
    expect(normalizeLayout({ nav: '200px', main: 50 }, new Set(['nav']), () => undefined)).toEqual({
      layout: { main: 50 },
      pins: {},
      lengths: new Set(),
    });
  });

  it('reads the font size of the panel that has the entry', () => {
    expect(
      normalizeLayout({ a: '10em', b: '10em' }, new Set(), (id) => ({
        ...measurement,
        em: id === 'a' ? 10 : 20,
      })).layout,
    ).toEqual({ a: 10, b: 20 });
  });

  it('keeps an id that an object also has', () => {
    const sizes = JSON.parse('{ "__proto__": "200px", "constructor": 30 }') as Record<
      string,
      number | string
    >;

    const { layout, pins } = normalizeLayout(sizes, new Set(['__proto__']), basis);

    expect(Object.keys(layout)).toEqual(['__proto__', 'constructor']);
    expect(Object.values(layout)).toEqual([20, 30]);
    expect(Object.keys(pins)).toEqual(['__proto__']);
    expect(Object.values(pins)).toEqual([200]);
  });

  it('leaves out an entry that is not a size', () => {
    const sizes = JSON.parse('{ "a": "12ch", "b": 40, "c": null }') as Record<string, unknown>;

    expect(normalizeLayout(sizes, new Set(['a']), basis)).toEqual({
      layout: { b: 40 },
      pins: {},
      lengths: new Set(),
    });
  });
});
});

describe('a layout with lengths', () => {
  const panels = (...ids: string[]) => ids.map((id) => panel(id));

  it('a length keeps its size, and the entries with a number share the rest in their ratio', () => {
    expect(resolveLayout(panels('a', 'b', 'c'), { a: 30, b: 24, c: 45 }, new Set(['b']))).toEqual({
      a: 30.4,
      b: 24,
      c: 45.6,
    });
  });

  it('with no entry of a number, or no room for the lengths, each entry keeps its ratio', () => {
    expect(resolveLayout(panels('a', 'b'), { a: 20, b: 30 }, new Set(['a', 'b']))).toEqual({
      a: 40,
      b: 60,
    });
    expect(resolveLayout(panels('a', 'b'), { a: 150, b: 50 }, new Set(['a']))).toEqual({
      a: 75,
      b: 25,
    });
  });
});

describe('toEventLayout', () => {
  it('gives a fixed panel its pixels with three decimals, and keeps the entry of a panel that is not mounted', () => {
    expect(
      toEventLayout(
        { a: 24.05, b: 75.95 },
        { a: 20, b: 60, gone: 20 },
        { a: 20, b: 60, gone: '100px', waits: '3em', bad: 'wide' },
        new Set(['a']),
        500.5,
      ),
    ).toEqual({ waits: '3em', gone: '100px', a: '120.37px', b: 60.76 });
  });

  it('gives an id that an object also has as an own key', () => {
    const layout = toEventLayout(
      JSON.parse('{ "__proto__": 40, "constructor": 60 }') as Record<string, number>,
      {},
      {},
      new Set(),
      undefined,
    );
    expect(Object.keys(layout)).toEqual(['__proto__', 'constructor']);
    expect(JSON.stringify(layout)).toBe('{"__proto__":40,"constructor":60}');
  });
});
