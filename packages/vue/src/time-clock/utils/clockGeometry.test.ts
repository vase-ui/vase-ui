import { describe, expect, it } from 'vitest';
import { angleOfPoint, angleOfPosition, positionOfAngle, ratioOfPoint } from './clockGeometry';

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
  it('is 0 at the center and 1 at the edge of the face', () => {
    expect(ratioOfPoint(center, rect)).toBe(0);
    expect(ratioOfPoint({ x: center.x + 100, y: center.y }, rect)).toBe(1);
  });

  it('measures the radius from the shorter side of a face that is not square', () => {
    const wide = { left: 0, top: 0, width: 300, height: 100 };
    expect(ratioOfPoint({ x: 150, y: 100 }, wide)).toBe(1);
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
