import { describe, expect, it } from 'vitest';
import { formatter } from '../format';
import type { TemporalValue } from '../temporal';
import { compareMoments, getInputLimits, getLimitMessage, laterMinimum } from './customValidity';
import type { ValueLimits } from './customValidity';

const day = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);

describe('getInputLimits', () => {
  const limits = () => ({
    minDate: day('2026-11-02'),
    maxDate: day('2026-11-20'),
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

  // A limit with a time is a moment, in the wall clock of its own zone.
  it.each([
    { kind: 'date', seconds: false, min: '2026-11-02', max: '2026-11-20' },
    { kind: 'dateTime', seconds: false, min: '2026-11-02T10:15', max: '2026-11-20T17:30' },
    { kind: 'dateTime', seconds: true, min: '2026-11-02T10:15:00', max: '2026-11-20T17:30:00' },
    { kind: 'zonedDateTime', seconds: false, min: undefined, max: undefined },
  ] as const)(
    'gives $min and $max for $kind with seconds $seconds and limits with a time',
    (row) => {
      const moments = {
        minDate: Temporal.PlainDateTime.from('2026-11-02T10:15'),
        maxDate: Temporal.ZonedDateTime.from('2026-11-20T17:30[Asia/Tokyo]'),
      };

      expect(getInputLimits(row.kind, moments, row.seconds)).toEqual({
        min: row.min,
        max: row.max,
      });
    },
  );

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
  const message = (value: TemporalValue, limits: ValueLimits) =>
    getLimitMessage(value, limits, 'en-US', 'gregory');

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

  describe('a limit with a time', () => {
    const limits = {
      minDate: Temporal.PlainDateTime.from('2026-11-10T10:00'),
      maxDate: Temporal.ZonedDateTime.from('2026-11-20T17:30[Asia/Tokyo]'),
    };
    const momentText = (value: Temporal.PlainDateTime | Temporal.ZonedDateTime) => {
      const [format, epoch] = formatter(
        value,
        { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' },
        'en-US',
      );
      return format.format(epoch);
    };

    it.each([
      {
        name: 'before the least time of the least day',
        value: '2026-11-10T09:59',
        expected: 'later',
      },
      { name: 'on the least time', value: '2026-11-10T10:00', expected: '' },
      { name: 'after the least time of the least day', value: '2026-11-10T10:01', expected: '' },
      { name: 'on the greatest time', value: '2026-11-20T17:30', expected: '' },
      {
        name: 'after the greatest time of its day',
        value: '2026-11-20T17:31',
        expected: 'earlier',
      },
      { name: 'on a day after the least day', value: '2026-11-11T00:00', expected: '' },
    ])('checks a zoned value $name', ({ value, expected }) => {
      const result = message(Temporal.ZonedDateTime.from(`${value}[Asia/Tokyo]`), limits);

      if (expected === '') {
        expect(result).toBe('');
      } else {
        expect(result).toContain(expected);
        expect(result).toContain(
          momentText(expected === 'later' ? limits.minDate : limits.maxDate),
        );
      }
    });

    it('compares a date that is a limit by the day, whatever the time of the value', () => {
      const dayLimits = { minDate: day('2026-11-10'), maxDate: day('2026-11-20') };

      expect(message(Temporal.ZonedDateTime.from('2026-11-10T00:00[Asia/Tokyo]'), dayLimits)).toBe(
        '',
      );
      expect(message(Temporal.ZonedDateTime.from('2026-11-20T23:59[Asia/Tokyo]'), dayLimits)).toBe(
        '',
      );
    });
  });

  it('writes the date of a message in the calendar that the field shows', () => {
    const minDate = day('2026-11-10');
    const [format, epoch] = formatter(
      minDate.withCalendar('persian'),
      { year: 'numeric', month: 'numeric', day: 'numeric' },
      'en-US',
    );

    expect(
      getLimitMessage(
        Temporal.ZonedDateTime.from('2026-11-09T10:00[Asia/Tokyo]'),
        { minDate },
        'en-US',
        'persian',
      ),
    ).toContain(format.format(epoch));
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

describe('compareMoments', () => {
  it.each([
    { name: 'a day before', a: '2026-11-09T23:59', b: '2026-11-10T00:00', expected: -1 },
    {
      name: 'a time before on one day',
      a: '2026-11-10T09:00',
      b: '2026-11-10T10:00',
      expected: -1,
    },
    { name: 'the same moment', a: '2026-11-10T10:00', b: '2026-11-10T10:00', expected: 0 },
    { name: 'a time after on one day', a: '2026-11-10T10:01', b: '2026-11-10T10:00', expected: 1 },
  ])('gives $expected for $name', ({ a, b, expected }) => {
    expect(
      Math.sign(compareMoments(Temporal.PlainDateTime.from(a), Temporal.PlainDateTime.from(b))),
    ).toBe(expected);
  });

  it('counts a date as the start of its day, and compares the wall clocks of two zones', () => {
    expect(compareMoments(day('2026-11-10'), Temporal.PlainDateTime.from('2026-11-10T00:00'))).toBe(
      0,
    );
    expect(
      compareMoments(
        Temporal.ZonedDateTime.from('2026-11-10T10:00[Asia/Tokyo]'),
        Temporal.ZonedDateTime.from('2026-11-10T10:00[America/New_York]'),
      ),
    ).toBe(0);
  });
});

describe('laterMinimum', () => {
  const at = (text: string) => Temporal.PlainDateTime.from(text);

  it.each([
    {
      name: 'no first minimum',
      a: undefined,
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    { name: 'no second minimum', a: '2026-11-10', b: null, expected: '2026-11-10' },
    {
      name: 'a later time of one day',
      a: '2026-11-10T08:00',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    {
      name: 'an earlier time of one day',
      a: '2026-11-10T10:00',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T10:00:00',
    },
    {
      name: 'a date that is the start of the same day',
      a: '2026-11-10',
      b: '2026-11-10T09:00',
      expected: '2026-11-10T09:00:00',
    },
    { name: 'a later date', a: '2026-11-12', b: '2026-11-10T17:00', expected: '2026-11-12' },
  ])('gives the later of two minimums with $name', ({ a, b, expected }) => {
    const parse = (text: string) => (text.includes('T') ? at(text) : day(text));

    expect(laterMinimum(a && parse(a), b && parse(b))?.toString()).toBe(expected);
  });
});
