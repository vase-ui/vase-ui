import { describe, expect, it, onTestFinished } from 'vitest';
import { getElementTransform } from './getElementTransform';

describe('getElementTransform', () => {
  it.each([
    { name: 'no transform', transform: '', expected: { x: 0, y: 0, scale: 1 } },
    {
      name: 'a 2D matrix',
      transform: 'translate(12px, 4px) scale(2)',
      expected: { x: 12, y: 4, scale: 2 },
    },
    {
      name: 'a 3D matrix',
      transform: 'translate3d(12px, 4px, 1px) scale(2)',
      expected: { x: 12, y: 4, scale: 2 },
    },
  ])('reads the translation and the scale of $name', ({ transform, expected }) => {
    const element = document.createElement('div');
    element.style.transform = transform;
    document.body.append(element);
    onTestFinished(() => element.remove());

    expect(getElementTransform(element)).toEqual(expected);
  });
});
