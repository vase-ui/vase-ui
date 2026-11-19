import { describe, expect, it } from 'vitest';
import {
  columnValues,
  isColumnValueAllowed,
  selectedColumnValue,
  timeOfColumnValue,
} from './TimePickerRootContext';

const time = (text: string) => Temporal.PlainTime.from(text);
const noLimits = { minTime: undefined, maxTime: undefined, disabledTimes: undefined };

describe('columnValues', () => {
  it.each([
    { unit: 'hour', hourCycle: 12, step: 1, values: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { unit: 'hour', hourCycle: 12, step: 3, values: [12, 3, 6, 9] },
    { unit: 'hour', hourCycle: 24, step: 6, values: [0, 6, 12, 18] },
    { unit: 'minute', hourCycle: 12, step: 20, values: [0, 20, 40] },
    { unit: 'second', hourCycle: 24, step: 25, values: [0, 25, 50] },
    { unit: 'dayPeriod', hourCycle: 12, step: 1, values: ['am', 'pm'] },
  ] as const)(
    'has the values of the $unit for $hourCycle hours and a step of $step',
    ({ unit, hourCycle, step, values }) => {
      expect(columnValues(unit, hourCycle, step)).toEqual(values);
    },
  );

  it('has 60 minutes and 24 hours for a step of 1', () => {
    expect(columnValues('minute', 24, 1)).toHaveLength(60);
    expect(columnValues('hour', 24, 1)).toHaveLength(24);
  });
});

describe('selectedColumnValue', () => {
  it.each([
    { unit: 'hour', hourCycle: 12, text: '00:15', value: 12 },
    { unit: 'hour', hourCycle: 12, text: '12:15', value: 12 },
    { unit: 'hour', hourCycle: 12, text: '15:15', value: 3 },
    { unit: 'hour', hourCycle: 24, text: '15:15', value: 15 },
    { unit: 'minute', hourCycle: 12, text: '15:16', value: 16 },
    { unit: 'second', hourCycle: 12, text: '15:16:17', value: 17 },
    { unit: 'dayPeriod', hourCycle: 12, text: '11:59', value: 'am' },
    { unit: 'dayPeriod', hourCycle: 12, text: '12:00', value: 'pm' },
  ] as const)('is $value for $text in the $unit', ({ unit, hourCycle, text, value }) => {
    expect(selectedColumnValue(unit, hourCycle, time(text))).toBe(value);
  });
});

describe('timeOfColumnValue', () => {
  it.each([
    { unit: 'hour', hourCycle: 12, from: '15:30:45', value: 9, to: '21:30:45' },
    { unit: 'hour', hourCycle: 12, from: '09:30', value: 12, to: '00:30:00' },
    { unit: 'hour', hourCycle: 12, from: '21:30', value: 12, to: '12:30:00' },
    { unit: 'hour', hourCycle: 24, from: '15:30', value: 7, to: '07:30:00' },
    { unit: 'minute', hourCycle: 12, from: '15:30:45', value: 5, to: '15:05:45' },
    { unit: 'second', hourCycle: 12, from: '15:30:45', value: 10, to: '15:30:10' },
    { unit: 'dayPeriod', hourCycle: 12, from: '09:30', value: 'pm', to: '21:30:00' },
    { unit: 'dayPeriod', hourCycle: 12, from: '21:30', value: 'am', to: '09:30:00' },
  ] as const)('sets the $unit to $value in $from', ({ unit, hourCycle, from, value, to }) => {
    expect(timeOfColumnValue(unit, hourCycle, time(from), value).toString()).toBe(to);
  });
});

describe('isColumnValueAllowed', () => {
  const limits = { ...noLimits, minTime: time('09:30'), maxTime: time('17:45') };

  it.each([
    { unit: 'hour', value: 8, at: '12:00', allowed: false },
    { unit: 'hour', value: 9, at: '12:00', allowed: true },
    { unit: 'hour', value: 17, at: '12:00', allowed: true },
    { unit: 'hour', value: 18, at: '12:00', allowed: false },
    { unit: 'minute', value: 0, at: '09:00', allowed: false },
    { unit: 'minute', value: 30, at: '09:00', allowed: true },
    { unit: 'minute', value: 45, at: '17:00', allowed: true },
    { unit: 'minute', value: 46, at: '17:00', allowed: false },
    { unit: 'dayPeriod', value: 'am', at: '12:00', allowed: true },
    { unit: 'dayPeriod', value: 'pm', at: '12:00', allowed: true },
  ] as const)('is $allowed for the $unit $value at $at', ({ unit, value, at, allowed }) => {
    expect(isColumnValueAllowed(unit, 24, time(at), value, limits)).toBe(allowed);
  });

  it('is false for a day period that has no time in the limits', () => {
    const afternoon = { ...noLimits, minTime: time('13:00') };

    expect(isColumnValueAllowed('dayPeriod', 12, time('15:00'), 'am', afternoon)).toBe(false);
    expect(isColumnValueAllowed('dayPeriod', 12, time('15:00'), 'pm', afternoon)).toBe(true);
  });

  it('is false for a value that the function of the consumer disables', () => {
    const limitsWithFunction = {
      ...noLimits,
      disabledTimes: (candidate: Temporal.PlainTime) => candidate.hour === 10,
    };

    expect(isColumnValueAllowed('hour', 24, time('12:00'), 10, limitsWithFunction)).toBe(false);
    expect(isColumnValueAllowed('hour', 24, time('12:00'), 11, limitsWithFunction)).toBe(true);
  });
});
