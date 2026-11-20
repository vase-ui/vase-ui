import { describe, expect, it } from 'vitest';
import { isValidListStep, listTimes } from './times';

const texts = (...parameters: Parameters<typeof listTimes>) =>
  listTimes(...parameters).map((time) => time.toString());

describe('listTimes', () => {
  it('starts at midnight and ends at the last time of the day with no limit', () => {
    const times = texts(30, undefined, undefined);

    expect(times).toHaveLength(48);
    expect(times.at(0)).toBe('00:00:00');
    expect(times.at(-1)).toBe('23:30:00');
  });

  it('starts at the minimum, goes on by the step, and ends at the maximum', () => {
    expect(texts(45, '09:15', '10:45')).toEqual(['09:15:00', '10:00:00', '10:45:00']);
  });

  it('keeps the seconds of the minimum', () => {
    expect(texts(30, '09:00:30', '10:00')).toEqual(['09:00:30', '09:30:30']);
  });

  it('does not go round at midnight', () => {
    expect(texts(30, '23:00', undefined)).toEqual(['23:00:00', '23:30:00']);
    expect(texts(1440, undefined, undefined)).toEqual(['00:00:00']);
  });

  it('has no time when the minimum is after the maximum', () => {
    expect(texts(30, '11:00', '10:00')).toEqual([]);
  });
});

describe('isValidListStep', () => {
  it.each([
    { step: 1, valid: true },
    { step: 30, valid: true },
    { step: 0, valid: false },
    { step: -5, valid: false },
    { step: 2.5, valid: false },
    { step: Number.NaN, valid: false },
    { step: Number.POSITIVE_INFINITY, valid: false },
  ])('is $valid for $step', ({ step, valid }) => {
    expect(isValidListStep(step)).toBe(valid);
  });
});
