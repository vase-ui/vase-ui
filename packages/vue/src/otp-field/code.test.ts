import { describe, expect, test, vi } from 'vitest';
import { inputmodeOf, patternOf, removeAt, toCode, writeAt } from './code';
import type { OTPFieldRootValidationType } from './types';

const rules = (
  length: number,
  validationType: OTPFieldRootValidationType,
  normalizeValue?: (value: string) => string,
) => ({ length, validationType, normalizeValue });

describe('toCode', () => {
  test('removes white space, and white space is not refused', () => {
    expect(toCode(' 12 3\t4\n5 ', rules(6, 'numeric'))).toEqual({ code: '12345', refused: false });
    expect(toCode(' \t', rules(6, 'numeric'))).toEqual({ code: '', refused: false });
  });

  test('gives an empty code for null and undefined', () => {
    expect(toCode(null, rules(6, 'numeric')).code).toBe('');
    expect(toCode(undefined, rules(6, 'alpha')).code).toBe('');
  });

  test.each([
    { type: 'numeric', text: '1a 2b34c56', length: 4, code: '1234' },
    { type: 'alpha', text: '1a 2b3C4', length: 6, code: 'abC' },
    { type: 'alphanumeric', text: 'A1-B2 c3!', length: 6, code: 'A1B2c3' },
  ] as const)(
    'keeps the characters of the type $type and at most `length` characters',
    ({ type, text, length, code }) => {
      expect(toCode(text, rules(length, type))).toEqual({ code, refused: true });
    },
  );

  test('takes the normalizer as the whole rule for the type none', () => {
    const normalizeValue = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    expect(toCode('ab-12 cd', rules(6, 'none', normalizeValue))).toEqual({
      code: 'AB12CD',
      refused: true,
    });
  });

  test('calls the normalizer one time, after the filter of the type', () => {
    const normalizeValue = vi.fn((value: string) => value.toUpperCase());
    expect(toCode('ab-12 cd!', rules(6, 'alphanumeric', normalizeValue)).code).toBe('AB12CD');
    expect(normalizeValue).toHaveBeenCalledTimes(1);
    expect(normalizeValue).toHaveBeenCalledWith('ab12cd');
  });

  test('filters the result of the normalizer by the type again, and refuses what it removes', () => {
    expect(
      toCode(
        '12',
        rules(6, 'numeric', (value) => `${value}AB`),
      ),
    ).toEqual({
      code: '12',
      refused: true,
    });
  });

  test('refuses what the normalizer removes', () => {
    expect(
      toCode(
        '1203',
        rules(6, 'numeric', (value) => value.replaceAll('0', '')),
      ),
    ).toEqual({
      code: '123',
      refused: true,
    });
  });

  test('keeps `length` characters after the normalizer, and refuses the others', () => {
    expect(
      toCode(
        '123456',
        rules(4, 'numeric', (value) => `${value}789`),
      ),
    ).toEqual({
      code: '1234',
      refused: true,
    });
    expect(toCode('1234', rules(4, 'numeric')).refused).toBe(false);
  });

  test('gives an empty code for a negative length', () => {
    expect(toCode('1234', rules(-1, 'none')).code).toBe('');
  });

  test('VUE-144: counts a supplementary character as one character', () => {
    expect(toCode('𠮷A𠮷', rules(2, 'none'))).toEqual({ code: '𠮷A', refused: true });
  });
});

describe('writeAt', () => {
  test.each([
    { index: 2, accepted: '99', code: '129956' },
    { index: 0, accepted: '99', code: '993456' },
    { index: 5, accepted: '9', code: '123459' },
  ])('writes $accepted from the slot $index on', ({ index, accepted, code }) => {
    expect(writeAt('123456', index, accepted, rules(6, 'numeric'))).toBe(code);
  });

  test('runs the normalizer on the new code', () => {
    const upper = (value: string) => value.toUpperCase();
    const accepted = toCode('ab', rules(6, 'alphanumeric', upper)).code;
    expect(writeAt('123456', 2, accepted, rules(6, 'alphanumeric', upper))).toBe('12AB56');
  });

  test('keeps the later characters when the normalizer removes a part of the text', () => {
    const lowDigits = rules(4, 'numeric', (value) => value.replace(/[^0-3]/g, ''));
    expect(writeAt('1303', 1, toCode('29', lowDigits).code, lowDigits)).toBe('1203');
  });
});

describe('removeAt', () => {
  test.each([
    { index: 0, code: '234' },
    { index: 3, code: '123' },
    { index: 10, code: '1234' },
  ])('removes the character of the slot $index', ({ index, code }) => {
    expect(removeAt('1234', index)).toBe(code);
  });
});

test('each type has a pattern of a whole code and a keyboard', () => {
  expect(
    (['numeric', 'alpha', 'alphanumeric', 'none'] as const).map((type) => [
      patternOf(type, 6),
      inputmodeOf(type),
    ]),
  ).toEqual([
    ['\\d{6}', 'numeric'],
    ['[a-zA-Z]{6}', 'text'],
    ['[a-zA-Z0-9]{6}', 'text'],
    ['.{6}', undefined],
  ]);
  const pattern = new RegExp(`^(?:${patternOf('none', 2)})$`, 'v');
  expect(pattern.test('𠮷A')).toBe(true);
  expect(pattern.test('𠮷')).toBe(false);
});
