import { describe, expect, it } from 'vitest';
import { isLength, isViewportLength, normalizeLayout, parsePixels, parseSize } from './layout';
import type { Measurement } from './layout';

// One percent of the panel space is 10 px, and 1% of the viewport is 12 px by 8 px.
const measurement: Measurement = {
  space: 1000,
  rem: 16,
  em: 20,
  viewportWidth: 1200,
  viewportHeight: 800,
};

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
  ])('throws for $name', ({ value }) => {
    expect(() => parseSize(value, measurement)).toThrow(/^Vase UI: The size .* is not valid\./);
    expect(() => parseSize(value, undefined)).toThrow(/^Vase UI: The size .* is not valid\./);
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
    });
  });

  it('gives no pixels for a fixed panel that has a percent', () => {
    expect(normalizeLayout({ nav: '20%' }, new Set(['nav']), basis)).toEqual({
      layout: { nav: 20 },
      pins: {},
    });
  });

  it('leaves out a length while there is no measurement', () => {
    expect(normalizeLayout({ nav: '200px', main: 50 }, new Set(['nav']), () => undefined)).toEqual({
      layout: { main: 50 },
      pins: {},
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
    const snapshot = JSON.parse('{ "__proto__": "200px", "constructor": 30 }') as Record<
      string,
      number | string
    >;

    const { layout, pins } = normalizeLayout(snapshot, new Set(['__proto__']), basis);

    expect(Object.keys(layout)).toEqual(['__proto__', 'constructor']);
    expect(Object.values(layout)).toEqual([20, 30]);
    expect(Object.keys(pins)).toEqual(['__proto__']);
    expect(Object.values(pins)).toEqual([200]);
  });

  it('leaves out an entry that is not a size', () => {
    const snapshot = JSON.parse('{ "a": "12ch", "b": 40, "c": null }') as Record<
      string,
      number | string
    >;

    expect(normalizeLayout(snapshot, new Set(['a']), basis)).toEqual({
      layout: { b: 40 },
      pins: {},
    });
  });
});
