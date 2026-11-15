import { describe, expect, it } from 'vitest';
import { getBoundaries, getEdgeAreas } from './edges';

describe('getEdgeAreas', () => {
  it.each([
    {
      name: 'siblings with no gap',
      before: { start: 0, end: 300 },
      after: { start: 300, end: 900 },
      adjacent: true,
      size: 10,
      expected: [{ start: 295, end: 305 }],
    },
    {
      name: 'a gap of 16 with the size 10',
      before: { start: 0, end: 300 },
      after: { start: 316, end: 900 },
      adjacent: true,
      size: 10,
      expected: [{ start: 300, end: 316 }],
    },
    {
      name: 'a gap of 180 and no sibling',
      before: { start: 0, end: 300 },
      after: { start: 480, end: 900 },
      adjacent: false,
      size: 10,
      expected: [
        { start: 295, end: 305 },
        { start: 475, end: 485 },
      ],
    },
    {
      name: 'a gap of 6 and no sibling',
      before: { start: 0, end: 300 },
      after: { start: 306, end: 900 },
      adjacent: false,
      size: 10,
      expected: [{ start: 298, end: 308 }],
    },
    {
      name: 'the size 0 with no gap',
      before: { start: 0, end: 300 },
      after: { start: 300, end: 900 },
      adjacent: true,
      size: 0,
      expected: [],
    },
    {
      name: 'the size 0 and a gap of 180',
      before: { start: 0, end: 300 },
      after: { start: 480, end: 900 },
      adjacent: false,
      size: 0,
      expected: [],
    },
    {
      name: 'the panel before on the right',
      before: { start: 600, end: 900 },
      after: { start: 0, end: 600 },
      adjacent: true,
      size: 10,
      expected: [{ start: 595, end: 605 }],
    },
  ])('gives the areas for $name', ({ before, after, adjacent, size, expected }) => {
    expect(getEdgeAreas(before, after, size, adjacent)).toEqual(expected);
  });
});

describe('getBoundaries', () => {
  const a = { id: 'a', index: 0, disabled: false };
  const b = { id: 'b', index: 1, disabled: false };
  const c = { id: 'c', index: 2, disabled: false };
  // A handle at the index 1 pushes the panels after it one place on.
  const bAfterHandle = { ...b, index: 2 };
  const cAfterHandle = { ...c, index: 3 };
  const idsOf = (boundaries: { before: { id: string }; after: { id: string } }[]) =>
    boundaries.map(({ before, after }) => `${before.id}|${after.id}`);

  it.each([
    { name: 'two panels and no handle', panels: [a, b], handles: [], expected: ['a|b'] },
    {
      name: 'three panels and no handle',
      panels: [a, b, c],
      handles: [],
      expected: ['a|b', 'b|c'],
    },
    {
      name: 'three panels and one handle',
      panels: [a, bAfterHandle, cAfterHandle],
      handles: [1],
      expected: ['b|c'],
    },
    { name: 'a handle between the two', panels: [a, bAfterHandle], handles: [1], expected: [] },
    {
      name: 'a disabled panel before the boundary',
      panels: [{ ...a, disabled: true }, b],
      handles: [],
      expected: [],
    },
    {
      name: 'a disabled panel after the boundary',
      panels: [a, { ...b, disabled: true }],
      handles: [],
      expected: [],
    },
    {
      name: 'a disabled panel on one side only',
      panels: [{ ...a, disabled: true }, b, c],
      handles: [],
      expected: ['b|c'],
    },
    {
      name: 'a disabled panel with a free panel after',
      panels: [a, { ...b, disabled: true }, c],
      handles: [],
      expected: ['a|b', 'b|c'],
    },
  ])('finds the boundaries of $name', ({ panels, handles, expected }) => {
    expect(idsOf(getBoundaries(panels, handles, false))).toEqual(expected);
  });

  it('finds no boundary in a disabled root', () => {
    expect(getBoundaries([a, b, c], [], true)).toEqual([]);
  });
});
