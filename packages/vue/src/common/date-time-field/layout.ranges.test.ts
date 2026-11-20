import { describe, expect, it } from 'vitest';
import { digits as getDigits } from '../../internals/date-time/format';
import type { HourCycle } from './layout';
import {
  dayPeriodOfLetter,
  digitOf,
  fromNumbers,
  getLimits,
  getPadding,
  getRange,
  parseLocaleText,
  shiftYear,
  toNumbers,
  typeDigit,
  wrapNumber,
} from './layout';
import type { NumbersContext } from './layout';

const gregory = (hourCycle?: HourCycle): NumbersContext => ({
  calendar: 'gregory',
  hourCycle,
  hasDate: true,
  hasTime: true,
});

describe('typeDigit', () => {
  const month = { min: 1, max: 12 };
  it.each([
    {
      name: 'a first digit that can grow',
      typed: '',
      digit: 1,
      range: month,
      expected: { number: 1, digits: '1', advance: false },
    },
    {
      name: 'a digit that fills the segment',
      typed: '1',
      digit: 2,
      range: month,
      expected: { number: 12, digits: '', advance: true },
    },
    {
      name: 'a first digit that cannot grow',
      typed: '',
      digit: 3,
      range: month,
      expected: { number: 3, digits: '', advance: true },
    },
    {
      name: 'a digit that makes a number above',
      typed: '1',
      digit: 3,
      range: month,
      expected: { number: 3, digits: '', advance: true },
    },
    {
      name: 'a zero below the range',
      typed: '',
      digit: 0,
      range: month,
      expected: { number: undefined, digits: '0', advance: false },
    },
    {
      name: 'a digit after a zero',
      typed: '0',
      digit: 5,
      range: month,
      expected: { number: 5, digits: '', advance: true },
    },
    {
      name: 'zeros past the length',
      typed: '00',
      digit: 0,
      range: month,
      expected: { number: undefined, digits: '', advance: false },
    },
    {
      name: 'a zero in the range of an hour',
      typed: '',
      digit: 0,
      range: { min: 0, max: 23 },
      expected: { number: 0, digits: '0', advance: false },
    },
    {
      name: 'the fourth digit of a year',
      typed: '202',
      digit: 6,
      range: { min: 1, max: 9999 },
      expected: { number: 2026, digits: '', advance: true },
    },
  ])('gives the number for $name', ({ typed, digit, range, expected }) => {
    expect(typeDigit(typed, digit, range)).toEqual(expected);
  });
});

describe('number helpers', () => {
  it.each([
    { value: 13, range: { min: 1, max: 12 }, expected: 1 },
    { value: 0, range: { min: 1, max: 12 }, expected: 12 },
    { value: -1, range: { min: 0, max: 59 }, expected: 59 },
    { value: 60, range: { min: 0, max: 59 }, expected: 0 },
    { value: 25, range: { min: 0, max: 23 }, expected: 1 },
    { value: 7, range: { min: 1, max: 12 }, expected: 7 },
  ])('wraps $value in $range.min to $range.max', ({ value, range, expected }) => {
    expect(wrapNumber(value, range)).toBe(expected);
  });

  it.each([
    { name: 'the year', type: 'year', expected: { min: 1, max: 9999 } },
    { name: 'the month', type: 'month', expected: { min: 1, max: 13 } },
    { name: 'the day', type: 'day', expected: { min: 1, max: 29 } },
    { name: 'the minute', type: 'minute', expected: { min: 0, max: 59 } },
    { name: 'the second', type: 'second', expected: { min: 0, max: 59 } },
    { name: 'the hour of h11', type: 'hour', hourCycle: 'h11', expected: { min: 0, max: 11 } },
    { name: 'the hour of h12', type: 'hour', hourCycle: 'h12', expected: { min: 1, max: 12 } },
    { name: 'the hour of h23', type: 'hour', hourCycle: 'h23', expected: { min: 0, max: 23 } },
    { name: 'the hour of h24', type: 'hour', hourCycle: 'h24', expected: { min: 1, max: 24 } },
    { name: 'the hour with no cycle', type: 'hour', expected: { min: 0, max: 23 } },
  ] as const)('gives the range of $name', ({ type, expected, ...row }) => {
    const hourCycle = 'hourCycle' in row ? row.hourCycle : undefined;
    expect(getRange(type, { monthsInYear: 13, daysInMonth: 29 }, hourCycle)).toEqual(expected);
  });

  it.each([
    { type: 'minute', hourCycle: 'h12', force: false, expected: 2 },
    { type: 'hour', hourCycle: 'h12', force: false, expected: 1 },
    { type: 'hour', hourCycle: 'h12', force: true, expected: 2 },
    { type: 'hour', hourCycle: 'h23', force: false, expected: 2 },
    { type: 'month', hourCycle: undefined, force: false, expected: 1 },
    { type: 'day', hourCycle: undefined, force: true, expected: 2 },
    { type: 'year', hourCycle: undefined, force: true, expected: 1 },
  ] as const)('pads $type to $expected digits with force $force', (row) => {
    expect(getPadding(row.type, row.hourCycle, row.force)).toBe(row.expected);
  });

  it.each([
    { name: 'ASCII', character: '5', digits: 'en', expected: 5 },
    { name: 'the numbering system', character: '٣', digits: 'ar-EG', expected: 3 },
    { name: 'a full width digit', character: '５', digits: 'en', expected: 5 },
    { name: 'a digit of another system', character: '٣', digits: 'en', expected: undefined },
    { name: 'a letter', character: 'a', digits: 'ar-EG', expected: undefined },
  ])('reads a digit in $name', ({ character, digits, expected }) => {
    expect(digitOf(character, getDigits(digits))).toBe(expected);
  });

  it.each([
    { letter: 'a', expected: 'am', texts: { am: 'AM', pm: 'PM' } },
    { letter: 'P', expected: 'pm', texts: { am: 'AM', pm: 'PM' } },
    { letter: 'x', expected: undefined, texts: { am: 'AM', pm: 'PM' } },
    { letter: 'a', expected: undefined, texts: { am: 'a.m.', pm: 'afternoon' } },
  ] as const)(
    'gives $expected for the letter $letter in $texts.am',
    ({ letter, expected, texts }) => {
      expect(dayPeriodOfLetter(letter, texts)).toBe(expected);
    },
  );
});

describe('numbers of a value', () => {
  it.each([
    { time: '00:30', hourCycle: 'h12', hour: 12, dayPeriod: 'am' },
    { time: '00:30', hourCycle: 'h11', hour: 0, dayPeriod: 'am' },
    { time: '00:30', hourCycle: 'h23', hour: 0, dayPeriod: 'am' },
    { time: '00:30', hourCycle: 'h24', hour: 24, dayPeriod: 'am' },
    { time: '12:00', hourCycle: 'h12', hour: 12, dayPeriod: 'pm' },
    { time: '12:00', hourCycle: 'h11', hour: 0, dayPeriod: 'pm' },
    { time: '15:00', hourCycle: 'h12', hour: 3, dayPeriod: 'pm' },
    { time: '23:00', hourCycle: undefined, hour: 23, dayPeriod: 'pm' },
  ] as const)('shows $time as $hour $dayPeriod in $hourCycle', (row) => {
    const value = Temporal.PlainTime.from(row.time);
    const numbers = toNumbers(value, 'gregory', row.hourCycle);

    expect(numbers).toMatchObject({ hour: row.hour, dayPeriod: row.dayPeriod });
    expect(fromNumbers(numbers, value, gregory(row.hourCycle)).equals(value)).toBe(true);
  });

  it.each([
    { name: 'a date', value: '2026-11-14', kind: 'date' },
    { name: 'a date and time', value: '2026-11-14T15:04:33', kind: 'dateTime' },
    { name: 'a year and month', value: '2026-11', kind: 'yearMonth' },
  ] as const)('gives the numbers of $name', ({ value, kind }) => {
    const parsed = {
      date: () => Temporal.PlainDate.from(value),
      dateTime: () => Temporal.PlainDateTime.from(value),
      yearMonth: () => Temporal.PlainYearMonth.from(value),
    }[kind]();
    const numbers = toNumbers(parsed, 'gregory', 'h23');

    expect(numbers).toMatchObject({ era: 'ce', year: 2026, month: 11 });
    expect(numbers.day).toBe(kind === 'yearMonth' ? 1 : 14);
    expect(numbers.hour !== undefined).toBe(kind === 'dateTime');
  });

  it('keeps the kind, the calendar, the time and the zone of the template', () => {
    const zoned = Temporal.ZonedDateTime.from('2026-11-14T15:04:33[Asia/Tokyo]');
    const changed = fromNumbers(
      { ...toNumbers(zoned, 'gregory', 'h23'), day: 20 },
      zoned,
      gregory(),
    );
    expect(changed.toString()).toBe('2026-11-20T15:04:33+09:00[Asia/Tokyo]');

    const dateTime = Temporal.PlainDateTime.from('2026-11-14T15:04:33');
    expect(fromNumbers({ minute: 30 }, dateTime, gregory('h23')).toString()).toBe(
      '2026-11-14T15:30:33',
    );

    const iso = Temporal.PlainDate.from('2026-11-14');
    const persian = Temporal.PlainDate.from({ calendar: 'persian', year: 1405, month: 9, day: 1 });
    const inPersian = fromNumbers({ era: 'ap', year: 1405, month: 9, day: 1 }, iso, {
      ...gregory(),
      calendar: 'persian',
    });
    expect(inPersian.calendarId).toBe('iso8601');
    expect(inPersian.equals(persian.withCalendar('iso8601'))).toBe(true);
  });

  it('moves a time in the gap of a zone change forward', () => {
    const before = Temporal.ZonedDateTime.from('2026-03-08T01:30[America/New_York]');
    const value = fromNumbers({ hour: 2, minute: 30 }, before, gregory('h23'));
    expect(value.hour).toBe(3);
  });

  it.each([
    { name: 'a day above the month', numbers: { month: 2, day: 31 }, expected: '2026-02-28' },
    {
      name: 'a day in a leap year',
      numbers: { year: 2028, month: 2, day: 31 },
      expected: '2028-02-29',
    },
    { name: 'a month alone', numbers: { month: 4 }, expected: '2026-04-30' },
  ])('constrains $name', ({ numbers, expected }) => {
    const template = Temporal.PlainDate.from('2026-01-31');
    expect(fromNumbers(numbers, template, gregory()).toString()).toBe(expected);
  });

  it('gives a year and month the first day of its month', () => {
    const template = Temporal.PlainYearMonth.from('2026-11');
    expect(fromNumbers({ month: 12, day: 9 }, template, gregory()).toString()).toBe('2026-12');
  });
});

describe('limits and years', () => {
  it.each([
    { name: 'a day in a leap year', numbers: { year: 2028, month: 2 }, months: 12, days: 29 },
    { name: 'a day in a common year', numbers: { year: 2026, month: 2 }, months: 12, days: 28 },
    { name: 'a year with no month', numbers: { year: 2026 }, months: 12, days: 31 },
    { name: 'no year', numbers: {}, months: 12, days: 31 },
    { name: 'a month with no year', numbers: { month: 2 }, months: 12, days: 31 },
  ])('gives the limits for $name', ({ numbers, months, days }) => {
    expect(getLimits({ era: 'ce', ...numbers }, 'gregory')).toEqual({
      monthsInYear: months,
      daysInMonth: days,
    });
  });

  it('gives a Hebrew leap year 13 months, a common year 12, and no year the widest range', () => {
    expect(getLimits({ era: 'am', year: 5784, month: 13 }, 'hebrew')).toEqual({
      monthsInYear: 13,
      daysInMonth: 29,
    });
    expect(getLimits({ era: 'am', year: 5785 }, 'hebrew').monthsInYear).toBe(12);
    expect(getLimits({}, 'hebrew')).toEqual({ monthsInYear: 13, daysInMonth: 31 });
  });

  it.each([
    {
      name: 'CE 1 down',
      numbers: { era: 'ce', year: 1 },
      amount: -1,
      expected: { era: 'bce', year: 1 },
    },
    {
      name: 'BCE 1 up',
      numbers: { era: 'bce', year: 1 },
      amount: 1,
      expected: { era: 'ce', year: 1 },
    },
    {
      name: '2026 up by 5',
      numbers: { era: 'ce', year: 2026 },
      amount: 5,
      expected: { era: 'ce', year: 2031 },
    },
    {
      name: 'the greatest year up',
      numbers: { era: 'ce', year: 9999 },
      amount: 1,
      expected: { era: 'ce', year: 9999 },
    },
    {
      name: 'the greatest year BCE down',
      numbers: { era: 'bce', year: 9999 },
      amount: -1,
      expected: { era: 'bce', year: 9999 },
    },
  ])('shifts $name', ({ numbers, amount, expected }) => {
    expect(shiftYear(numbers, amount, 'gregory')).toEqual(expected);
  });

  it('shifts a year into the era before it', () => {
    // Reiwa starts in May of its year 1, so a date one year before the year 1 is in Heisei 30.
    expect(shiftYear({ era: 'reiwa', year: 1 }, -1, 'japanese')).toEqual({
      era: 'heisei',
      year: 30,
    });
    expect(shiftYear({ era: 'reiwa', year: 5 }, -1, 'japanese')).toEqual({ era: 'reiwa', year: 4 });
  });
});

describe('parseLocaleText', () => {
  const ascii = getDigits('en');
  const periods = { am: 'AM', pm: 'PM' };

  it.each([
    {
      name: 'month, day and year',
      text: '11/14/2026',
      types: ['month', 'day', 'year'],
      expected: { month: 11, day: 14, year: 2026 },
    },
    {
      name: 'day, month and year',
      text: '14.11.2026',
      types: ['day', 'month', 'year'],
      expected: { day: 14, month: 11, year: 2026 },
    },
    {
      name: 'a time with a day period',
      text: '3:04 pm',
      types: ['hour', 'minute', 'dayPeriod'],
      expected: { hour: 3, minute: 4, dayPeriod: 'pm' },
    },
    {
      name: 'too few numbers',
      text: '11/2026',
      types: ['month', 'day', 'year'],
      expected: undefined,
    },
    {
      name: 'a missing day period',
      text: '3:04',
      types: ['hour', 'minute', 'dayPeriod'],
      expected: undefined,
    },
  ] as const)('reads $name', ({ text, types, expected }) => {
    expect(parseLocaleText(text, types, ascii, periods)).toEqual(expected);
  });

  it('reads the digits of the numbering system of the locale', () => {
    const arabic = getDigits('ar-EG');
    expect(parseLocaleText('١٤/١١/٢٠٢٦', ['day', 'month', 'year'], arabic, periods)).toEqual({
      day: 14,
      month: 11,
      year: 2026,
    });
  });
});
