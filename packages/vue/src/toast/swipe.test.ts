import { describe, expect, it } from 'vitest';
import {
  applyDirectionalDamping,
  getDismissDirection,
  shouldCancelReverseSwipe,
  updateSwipeCancelBaseline,
} from './swipe';

describe('the swipe math of Toast', () => {
  it('damps only a delta toward a direction that does not dismiss', () => {
    expect(applyDirectionalDamping(100, 100, ['down', 'right'])).toEqual({ x: 100, y: 100 });
    expect(applyDirectionalDamping(-100, -100, ['down', 'right'])).toEqual({ x: -10, y: -10 });
    expect(applyDirectionalDamping(100, -100, ['up'])).toEqual({ x: 10, y: -100 });
    expect(applyDirectionalDamping(-100, 100, ['up'])).toEqual({ x: -10, y: 10 });
    expect(applyDirectionalDamping(0, 0, [])).toEqual({ x: 0, y: 0 });
  });

  it('moves the cancel baseline of an axis to the position where the pointer goes back', () => {
    const baseline = { x: 100, y: 100 };

    expect(updateSwipeCancelBaseline(baseline, { x: 100, y: 150 }, { x: 0, y: 50 })).toEqual(
      baseline,
    );
    expect(updateSwipeCancelBaseline(baseline, { x: 100, y: 150 }, { x: 0, y: -50 })).toEqual({
      x: 100,
      y: 150,
    });
    expect(updateSwipeCancelBaseline(baseline, { x: 60, y: 100 }, { x: 40, y: 0 })).toEqual({
      x: 60,
      y: 100,
    });
    expect(updateSwipeCancelBaseline(baseline, { x: 150, y: 50 }, { x: -10, y: 10 })).toEqual({
      x: 150,
      y: 50,
    });
  });

  it('cancels a swipe that goes back 10 px, unless the two directions of an axis dismiss', () => {
    expect(shouldCancelReverseSwipe(['down'], 100, 90)).toBe(true);
    expect(shouldCancelReverseSwipe(['down'], 100, 91)).toBe(false);
    expect(shouldCancelReverseSwipe(['down', 'right'], 100, 0)).toBe(true);
    expect(shouldCancelReverseSwipe(['up', 'down'], 100, 0)).toBe(false);
    expect(shouldCancelReverseSwipe(['left', 'right'], 100, 0)).toBe(false);
  });

  it('gives the first direction with a displacement of more than the threshold', () => {
    expect(getDismissDirection(['down', 'right'], 50, 50, 40)).toBe('down');
    expect(getDismissDirection(['right', 'down'], 50, 50, 40)).toBe('right');
    expect(getDismissDirection(['down', 'right'], 40, 40, 40)).toBe(undefined);
    expect(getDismissDirection(['up'], 0, 50, 40)).toBe(undefined);
    expect(getDismissDirection([], 500, 500, 40)).toBe(undefined);
  });
});
