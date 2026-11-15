import { describe, expect, it } from 'vitest';
import { getMeasurement, getPanelSize, isSameMeasurement } from './measure';
import type { RootMeasurement } from './measure';

const measurement: RootMeasurement = {
  space: 1000,
  scale: 1,
  rem: 16,
  rootFontSize: 14,
  panelFontSizes: new Map([['a', 20]]),
  viewportWidth: 1200,
  viewportHeight: 800,
};

describe('isSameMeasurement', () => {
  it.each([
    {
      name: 'a space that differs a little',
      change: { space: 1000.04 },
      same: true,
    },
    { name: 'a space that differs by a pixel', change: { space: 1001 }, same: false },
    { name: 'another scale', change: { scale: 0.5 }, same: false },
    { name: 'another font size of the document', change: { rem: 18 }, same: false },
    { name: 'another font size of the root', change: { rootFontSize: 16 }, same: false },
    { name: 'another width of the window', change: { viewportWidth: 1300 }, same: false },
    { name: 'another height of the window', change: { viewportHeight: 900 }, same: false },
    {
      name: 'another font size of a panel',
      change: { panelFontSizes: new Map([['a', 24]]) },
      same: false,
    },
    {
      name: 'a panel more',
      change: {
        panelFontSizes: new Map([
          ['a', 20],
          ['b', 20],
        ]),
      },
      same: false,
    },
    { name: 'the same numbers', change: { panelFontSizes: new Map([['a', 20]]) }, same: true },
  ])('tells $name', ({ change, same }) => {
    expect(isSameMeasurement(measurement, { ...measurement, ...change })).toBe(same);
  });
});

describe('getMeasurement', () => {
  it('gives the font size of the panel for a panel', () => {
    expect(getMeasurement(measurement, 'a')).toEqual({
      space: 1000,
      rem: 16,
      em: 20,
      viewportWidth: 1200,
      viewportHeight: 800,
    });
  });

  it.each([
    { name: 'no panel', id: undefined },
    { name: 'a panel that is not mounted', id: 'gone' },
  ])('gives the font size of the root for $name', ({ id }) => {
    expect(getMeasurement(measurement, id).em).toBe(14);
  });
});

describe('getPanelSize', () => {
  it.each([
    { name: 'a whole size', percent: 30, space: 1000, pixels: 300 },
    { name: 'three decimals', percent: 33.333, space: 1000, pixels: 333.33 },
    { name: 'a size that has more decimals', percent: 12.3456, space: 999, pixels: 123.333 },
    { name: 'no measurement', percent: 30, space: undefined, pixels: 0 },
  ])('gives the pixels for $name', ({ percent, space, pixels }) => {
    expect(getPanelSize(percent, space)).toEqual({ percent, pixels });
  });
});
