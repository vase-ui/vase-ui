import { describe, expect, it } from 'vitest';
import { isReleaseAtPressPoint } from './isReleaseAtPressPoint';

describe('isReleaseAtPressPoint', () => {
  const press = new MouseEvent('mousedown', { clientX: 100, clientY: 50 });

  it.each([
    { name: 'at the point of the press', dx: 0, dy: 0, still: true },
    { name: '8px right and 8px down', dx: 8, dy: 8, still: true },
    { name: '8px left and 8px up', dx: -8, dy: -8, still: true },
    { name: '9px right', dx: 9, dy: 0, still: false },
    { name: '9px left', dx: -9, dy: 0, still: false },
    { name: '9px down', dx: 0, dy: 9, still: false },
    { name: '9px up', dx: 0, dy: -9, still: false },
  ])('VUE-68: a release $name', ({ dx, dy, still }) => {
    const release = new MouseEvent('mouseup', { clientX: 100 + dx, clientY: 50 + dy });

    expect(isReleaseAtPressPoint(press, release)).toBe(still);
  });
});
