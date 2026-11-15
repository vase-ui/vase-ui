import { describe, expect, it } from 'vitest';
import { parseSize } from './parseSize';

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
  ])('gives the percent of $name', ({ value, expected }) => {
    expect(parseSize(value)).toBe(expected);
  });

  it.each([
    { name: 'a length', value: '200px' },
    { name: 'a unit that is not known', value: '12ch' },
    { name: 'text', value: 'wide' },
    { name: 'an empty string', value: '' },
    { name: 'a percent sign alone', value: '%' },
    { name: 'a space before the percent sign', value: '25 %' },
    { name: 'a number that is not finite', value: Number.NaN },
    { name: 'infinity', value: Number.POSITIVE_INFINITY },
    { name: 'a negative number', value: -10 },
    { name: 'a negative string', value: '-10%' },
  ])('throws for $name', ({ value }) => {
    expect(() => parseSize(value)).toThrow(/^Vase UI: The size .* is not valid\./);
  });
});
