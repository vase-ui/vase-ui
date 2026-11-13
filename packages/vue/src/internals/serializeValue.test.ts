import { expect, describe, it } from 'vitest';
import { serializeValue } from './serializeValue';

const selfReferring: Record<string, unknown> = {};
selfReferring.self = selfReferring;

describe('serializeValue', () => {
  it.each([
    { name: 'null', value: null, expected: '' },
    { name: 'undefined', value: undefined, expected: '' },
    { name: 'a string, with no quotes', value: 'text', expected: 'text' },
    { name: 'a number', value: 1.5, expected: '1.5' },
    { name: 'a Boolean', value: false, expected: 'false' },
    { name: 'an object', value: { a: 1, b: 'x' }, expected: '{"a":1,"b":"x"}' },
    { name: 'an array', value: [1, 'x', null], expected: '[1,"x",null]' },
    { name: 'an object that refers to itself', value: selfReferring, expected: '[object Object]' },
    { name: 'a bigint', value: 10n, expected: '10' },
  ])('gives the text of $name', ({ value, expected }) => {
    expect(serializeValue(value)).toBe(expected);
  });
});
