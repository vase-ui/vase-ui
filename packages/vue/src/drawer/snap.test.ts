import { describe, expect, it } from 'vitest';
import {
  findSnapPoint,
  releaseSnap,
  resolveSnapPoints,
  snapMovement,
  snapPointHeight,
  snapProgress,
  type ResolvedSnapPoint,
  type SnapRelease,
} from './snap';

const sizes = { popup: 300, viewport: 400, rootFontSize: 20 };

describe('snapPointHeight', () => {
  it.each([
    { point: 0.5, height: 200 },
    { point: 1, height: 400 },
    { point: -1, height: 0 },
    { point: 120, height: 120 },
    { point: '2rem', height: 40 },
    { point: ' 100px ', height: 100 },
    { point: 'invalid', height: null },
    { point: 'invalidpx', height: null },
    { point: '10vh', height: null },
    { point: Number.NaN, height: null },
  ])('gives $height for $point', ({ point, height }) => {
    expect(snapPointHeight(point, sizes)).toBe(height);
  });

  it('gives no height while the viewport has no height', () => {
    expect(snapPointHeight(0.5, { ...sizes, viewport: 0 })).toBeNull();
  });
});

describe('resolveSnapPoints', () => {
  it('resolves the units, removes values with no height, clamps the heights and keeps the last of two equal heights', () => {
    expect(
      resolveSnapPoints(
        [Number.NaN, 'invalid', 'invalidrem', -1, '2rem', '100px', 200, 200.5, 800],
        sizes,
      ),
    ).toEqual([
      { value: -1, height: 0, offset: 300 },
      { value: '2rem', height: 40, offset: 260 },
      { value: '100px', height: 100, offset: 200 },
      { value: 200.5, height: 200.5, offset: 99.5 },
      { value: 800, height: 300, offset: 0 },
    ]);
  });

  it('gives no point for an empty list, or before the popup and the viewport have a height', () => {
    expect(resolveSnapPoints([], sizes)).toEqual([]);
    expect(resolveSnapPoints(undefined, sizes)).toEqual([]);
    expect(resolveSnapPoints(['100px'], { ...sizes, popup: 0 })).toEqual([]);
    expect(resolveSnapPoints(['100px'], { ...sizes, viewport: 0 })).toEqual([]);
  });
});

describe('findSnapPoint', () => {
  const points = resolveSnapPoints([0.25, '200px', 1], sizes);

  it('resolves a value to its own point', () => {
    expect(findSnapPoint(points, '200px', sizes)?.offset).toBe(100);
  });

  it('resolves a value that the list does not have to the point with the nearest height', () => {
    expect(findSnapPoint(points, '190px', sizes)?.value).toBe('200px');
    expect(findSnapPoint(points, 0.3, sizes)?.value).toBe(0.25);
  });

  it('resolves `null` and a value with no height to no point', () => {
    expect(findSnapPoint(points, null, sizes)).toBeUndefined();
    expect(findSnapPoint(points, 'invalid', sizes)).toBeUndefined();
  });
});

describe('snapMovement', () => {
  it('gives the movement while the popup does not pass its open place', () => {
    expect(snapMovement(100, -40)).toBe(-40);
    expect(snapMovement(100, -100)).toBe(-100);
  });

  it('grows as a square root past the open place', () => {
    expect(snapMovement(100, -116)).toBe(-104);
    expect(snapMovement(0, -25)).toBe(-5);
  });
});

describe('snapProgress', () => {
  const points = resolveSnapPoints(['100px', '200px', 1], sizes);

  it('gives the place between the two points nearest the open place', () => {
    expect(snapProgress(points, 0)).toBe(0);
    expect(snapProgress(points, 50)).toBe(0.5);
    expect(snapProgress(points, 200)).toBe(1);
  });

  it('gives 0 with less than two points or with no active point', () => {
    expect(snapProgress(points.slice(0, 1), 100)).toBe(0);
    expect(snapProgress(points, null)).toBe(0);
  });
});

describe('releaseSnap', () => {
  // Offsets 0, 100 and 200 in a popup of 300 pixels.
  const points: ResolvedSnapPoint[] = resolveSnapPoints(['100px', '200px', 1], sizes);
  const at = (value: ResolvedSnapPoint['value']) => points.find((point) => point.value === value);

  function release(overrides: Partial<SnapRelease>) {
    return releaseSnap({
      points,
      offset: 100,
      delta: 0,
      velocity: 0,
      dragVelocity: 0,
      popupHeight: 300,
      sequential: false,
      directed: true,
      ...overrides,
    });
  }

  it('goes to the nearest point of a slow drag', () => {
    expect(release({ delta: 40 })).toBe(at('200px'));
    expect(release({ delta: 60 })).toBe(at('100px'));
    expect(release({ delta: -80 })).toBe(at(1));
  });

  it('closes when the closed place is nearer than each point', () => {
    expect(release({ delta: 160 })).toBeNull();
  });

  it('closes after a fast drag toward the closed place', () => {
    expect(release({ delta: 20, velocity: 0.5 })).toBeNull();
  });

  it('moves the target by the speed of the last sample', () => {
    expect(release({ offset: 200, delta: -20, velocity: -0.6 })).toBe(at(1));
    expect(release({ offset: 200, delta: -10, velocity: -0.4 })).toBe(at('100px'));
  });

  it('reads the speed of the whole drag when the last sample goes against a drag of 10 px or more', () => {
    expect(release({ offset: 200, delta: -40, velocity: 0.3, dragVelocity: -0.6 })).toBe(at(1));
    expect(release({ offset: 200, delta: -5, velocity: 0.3, dragVelocity: -0.6 })).toBe(
      at('100px'),
    );
  });

  it('goes to a point and never closes after a drag with no direction on the axis', () => {
    expect(release({ delta: 160, directed: false })).toBe(at('100px'));
    expect(release({ delta: 20, velocity: 0.5, directed: false })).toBe(at('100px'));
  });

  describe('with `snapToSequentialPoints`', () => {
    it('moves a fast drag one point at most', () => {
      expect(release({ offset: 200, delta: -30, velocity: -4, sequential: true })).toBe(
        at('200px'),
      );
      expect(release({ offset: 0, delta: 20, velocity: 4, sequential: true })).toBe(at('200px'));
    });

    it('goes to the nearest point of a slow drag', () => {
      expect(release({ offset: 200, delta: -160, sequential: true })).toBe(at(1));
    });

    it('closes a fast drag from the last point toward the closed place', () => {
      expect(release({ offset: 200, delta: 20, velocity: 1, sequential: true })).toBeNull();
    });
  });
});
