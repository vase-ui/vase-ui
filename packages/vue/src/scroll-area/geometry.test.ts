import { describe, expect, test } from 'vitest';
import {
  dragPosition,
  edgeDistances,
  thumbLength,
  thumbPlace,
  trackPressPosition,
  wheelPosition,
} from './geometry';

describe('edgeDistances', () => {
  test.each([
    { name: 'at the start', position: 0, distances: [0, 800] },
    { name: 'in the middle', position: 300, distances: [300, 500] },
    { name: '1px or less from the end', position: 799.2, distances: [800, 0] },
    { name: '1px or less from the start', position: 0.8, distances: [0, 800] },
    { name: 'out of the range', position: -40, distances: [0, 800] },
  ])('gives the distances $name', ({ position, distances }) => {
    expect(edgeDistances(position, 800)).toEqual(distances);
  });

  test('gives no distance to an axis with no overflow', () => {
    expect(edgeDistances(0, 0)).toEqual([0, 0]);
  });
});

describe('thumbLength', () => {
  test('is the free length by the visible part of the content, and 16px or more', () => {
    expect(thumbLength(200, 200, 1000)).toBe(40);
    expect(thumbLength(200, 200, 100000)).toBe(16);
  });
});

describe('thumbPlace', () => {
  test('moves the thumb over the free length that the thumb leaves', () => {
    expect(thumbPlace(400, 800, 200, 40, 1000)).toEqual({ offset: 80, length: 40 });
    expect(thumbPlace(0, 0, 200, 200, 200)).toEqual({ offset: 0, length: 200 });
  });

  test('keeps the thumb at the edge out of the range, and makes it shorter', () => {
    expect(thumbPlace(-50, 800, 200, 40, 1000)).toEqual({ offset: 0, length: 40000 / 1050 });
    expect(thumbPlace(850, 800, 200, 40, 1000)).toEqual({
      offset: 200 - 40000 / 1050,
      length: 40000 / 1050,
    });
    expect(thumbPlace(-100000, 800, 200, 40, 1000).length).toBe(16);
  });
});

describe('dragPosition', () => {
  test('scrolls the range by the move over the free length that the thumb leaves', () => {
    expect(dragPosition(100, 40, 200, 40, 800)).toBe(300);
    expect(dragPosition(-100, -40, 200, 40, 800)).toBe(-300);
  });

  test('does not scroll with a thumb that fills its track', () => {
    expect(dragPosition(100, 40, 16, 16, 800)).toBe(100);
    expect(dragPosition(100, 40, 10, 16, 800)).toBe(100);
  });
});

describe('trackPressPosition', () => {
  test('puts the centre of the thumb at the point, in the range', () => {
    expect(trackPressPosition(150, 200, 40, 800)).toBe(650);
    expect(trackPressPosition(5, 200, 40, 800)).toBe(0);
    expect(trackPressPosition(195, 200, 40, 800)).toBe(800);
  });

  test('gives no position for a thumb that fills its track', () => {
    expect(trackPressPosition(5, 16, 16, 800)).toBeUndefined();
  });
});

describe('wheelPosition', () => {
  test('adds the delta in the range', () => {
    expect(wheelPosition(0, 100, 0, 800)).toBe(100);
    expect(wheelPosition(750, 100, 0, 800)).toBe(800);
    expect(wheelPosition(0, -100, -800, 0)).toBe(-100);
  });

  test('gives no position at the edge in the direction of the delta, and for no delta', () => {
    expect(wheelPosition(0, -100, 0, 800)).toBeUndefined();
    expect(wheelPosition(800, 100, 0, 800)).toBeUndefined();
    expect(wheelPosition(400, 0, 0, 800)).toBeUndefined();
  });
});
