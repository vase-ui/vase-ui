import { describe, expect, it } from 'vitest';
import { formatter } from '../format';
import { getInputLimits, getLimitMessage } from './customValidity';

const day = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);

describe('getInputLimits', () => {
  const limits = () => ({
    minDate: day('2026-11-02'),
    maxDate: Temporal.ZonedDateTime.from('2026-11-20T23:30[Asia/Tokyo]'),
    minTime: time('09:00'),
    maxTime: time('17:30'),
  });

  it.each([
    { kind: 'date', seconds: false, min: '2026-11-02', max: '2026-11-20' },
    { kind: 'dateTime', seconds: false, min: '2026-11-02T00:00', max: '2026-11-20T23:59' },
    { kind: 'dateTime', seconds: true, min: '2026-11-02T00:00', max: '2026-11-20T23:59:59' },
    { kind: 'time', seconds: false, min: '09:00', max: '17:30' },
    { kind: 'time', seconds: true, min: '09:00:00', max: '17:30:00' },
    { kind: 'zonedDateTime', seconds: false, min: undefined, max: undefined },
    { kind: 'yearMonth', seconds: false, min: undefined, max: undefined },
  ] as const)('gives $min and $max for $kind with seconds $seconds', (row) => {
    expect(getInputLimits(row.kind, limits(), row.seconds)).toEqual({
      min: row.min,
      max: row.max,
    });
  });

  it('gives no limit for a limit that is not set', () => {
    expect(getInputLimits('date', {}, false)).toEqual({ min: undefined, max: undefined });
  });
});

describe('getLimitMessage', () => {
  const dayText = (value: Temporal.PlainDate) => {
    const [format, epoch] = formatter(
      value,
      { year: 'numeric', month: 'numeric', day: 'numeric' },
      'en-US',
    );
    return format.format(epoch);
  };
  const message = (
    ...[value, limits]: Parameters<typeof getLimitMessage> extends [
      infer Value,
      infer Limits,
      unknown,
    ]
      ? [Value, Limits]
      : never
  ) => getLimitMessage(value, limits, 'en-US');

  it.each([
    { name: 'before the least day', value: '2026-11-09T10:00[Asia/Tokyo]', expected: 'later' },
    { name: 'after the greatest day', value: '2026-11-21T00:30[Asia/Tokyo]', expected: 'earlier' },
    { name: 'on the greatest day', value: '2026-11-20T23:59[Asia/Tokyo]', expected: '' },
  ])('checks the range of a zoned value $name', ({ value, expected }) => {
    const limits = { minDate: day('2026-11-10'), maxDate: day('2026-11-20') };
    const result = message(Temporal.ZonedDateTime.from(value), limits);
    if (expected === '') {
      expect(result).toBe('');
    } else {
      expect(result).toContain(expected);
      expect(result).toContain(dayText(expected === 'later' ? limits.minDate : limits.maxDate));
    }
  });

  it.each([
    { name: 'a month before the month of the least day', value: '2026-10', expected: true },
    { name: 'the month of the least day', value: '2026-11', expected: false },
    { name: 'the month of the greatest day', value: '2027-01', expected: false },
    { name: 'a month after the month of the greatest day', value: '2027-02', expected: true },
  ])('checks the range of $name', ({ value, expected }) => {
    const limits = { minDate: day('2026-11-30'), maxDate: day('2027-01-01') };
    expect(message(Temporal.PlainYearMonth.from(value), limits) !== '').toBe(expected);
  });

  it('checks the time of a date and time, and leaves the range of a date to its input', () => {
    const limits = { minTime: time('09:00'), maxTime: time('17:30'), minDate: day('2026-11-20') };
    expect(message(Temporal.PlainDateTime.from('2026-11-14T08:59'), limits)).toContain('later');
    expect(message(Temporal.PlainDateTime.from('2026-11-14T17:31'), limits)).toContain('earlier');
    expect(message(Temporal.PlainDateTime.from('2026-11-14T12:00'), limits)).toBe('');
  });

  it('leaves the range of a time to its input', () => {
    expect(message(time('08:00'), { minTime: time('09:00') })).toBe('');
  });

  it('says that a date is not available', () => {
    const limits = { unavailableDates: { dayOfWeek: [6, 7] } };
    expect(message(day('2026-11-14'), limits)).not.toBe('');
    expect(message(day('2026-11-16'), limits)).toBe('');
    expect(message(Temporal.PlainYearMonth.from('2026-11'), limits)).toBe('');
  });
});
