import { describe, expect, it } from 'vitest';
import {
  angleOfPoint,
  angleOfPosition,
  outerRingRadius,
  positionOfAngle,
  ratioOfPoint,
} from './clockViews';

// A face that does not start at the origin, so a point is not an offset from the center.
const rect = { left: 20, top: 40, width: 200, height: 200 };
const center = { x: 120, y: 140 };

describe('angleOfPoint', () => {
  it.each([
    { name: 'the top', dx: 0, dy: -50, angle: 0 },
    { name: 'the right', dx: 50, dy: 0, angle: 90 },
    { name: 'the bottom', dx: 0, dy: 50, angle: 180 },
    { name: 'the left', dx: -50, dy: 0, angle: 270 },
    { name: 'the upper right', dx: 50, dy: -50, angle: 45 },
    { name: 'the upper left', dx: -50, dy: -50, angle: 315 },
  ])('gives $angle degrees at $name', ({ dx, dy, angle }) => {
    expect(angleOfPoint({ x: center.x + dx, y: center.y + dy }, rect)).toBeCloseTo(angle, 10);
  });

  it('gives a value below 360 for a point just left of the top', () => {
    const angle = angleOfPoint({ x: center.x - 0.001, y: center.y - 50 }, rect);
    expect(angle).toBeGreaterThan(359.9);
    expect(angle).toBeLessThan(360);
  });
});

describe('ratioOfPoint', () => {
  it('is 0 at the center and 1 at the radius', () => {
    expect(ratioOfPoint(center, rect, 80)).toBe(0);
    expect(ratioOfPoint({ x: center.x, y: center.y + 80 }, rect, 80)).toBe(1);
  });
});

describe('outerRingRadius', () => {
  it('is the mean distance of the centers of the numbers from the center of the face', () => {
    const number = (x: number, y: number) => ({ left: x - 10, top: y - 10, width: 20, height: 20 });

    expect(
      outerRingRadius(rect, [number(center.x, center.y - 70), number(center.x + 80, center.y)]),
    ).toBe(75);
  });

  it('is half of the shorter side of a face with no numbers', () => {
    const wide = { left: 0, top: 0, width: 300, height: 100 };
    expect(outerRingRadius(wide, [])).toBe(50);
  });
});

describe('positionOfAngle', () => {
  it.each([
    { name: 'rounds to the nearest hour mark', angle: 94, count: 12, step: 1, position: 3 },
    { name: 'starts the next mark at the middle', angle: 15, count: 12, step: 1, position: 1 },
    { name: 'ends the mark before the middle', angle: 14.9, count: 12, step: 1, position: 0 },
    { name: 'wraps the last mark to 0', angle: 359, count: 12, step: 1, position: 0 },
    { name: 'gives a minute', angle: 37, count: 60, step: 1, position: 6 },
    { name: 'rounds a minute to its step', angle: 37, count: 60, step: 5, position: 5 },
    { name: 'wraps a step that is not a divisor', angle: 359, count: 60, step: 7, position: 0 },
    { name: 'keeps the last mark before halfway', angle: 347.9, count: 60, step: 8, position: 56 },
    { name: 'wraps at the shortened midpoint', angle: 348, count: 60, step: 8, position: 0 },
  ])('$name', ({ angle, count, step, position }) => {
    expect(positionOfAngle(angle, count, step)).toBe(position);
  });
});

describe('angleOfPosition', () => {
  it.each([
    { position: 0, count: 12, angle: 0 },
    { position: 3, count: 12, angle: 90 },
    { position: 12, count: 12, angle: 0 },
    { position: 45, count: 60, angle: 270 },
  ])('gives $angle degrees for position $position of $count', ({ position, count, angle }) => {
    expect(angleOfPosition(position, count)).toBe(angle);
  });
});
