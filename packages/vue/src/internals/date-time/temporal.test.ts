import { Temporal as Polyfill } from 'temporal-polyfill/full/implementation';
import { describe, expect, it } from 'vitest';
import {
  compareDates,
  isKind,
  isSameDay,
  kindOf,
  parseInputText,
  toInputText,
  toPlainDate,
  toPlainTime,
  today,
  withDate,
  withTime,
  yearMonthInCalendar,
} from './temporal';

const day = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const dateTime = (text: string) => Temporal.PlainDateTime.from(text);
const zoned = (text: string) => Temporal.ZonedDateTime.from(text);
const month = (text: string) => Temporal.PlainYearMonth.from(text);

describe('kindOf', () => {
  it.each([
    { name: 'a date', make: () => day('2026-11-14'), expected: 'date' },
    { name: 'a time', make: () => time('10:30'), expected: 'time' },
    { name: 'a date and time', make: () => dateTime('2026-11-14T10:30'), expected: 'dateTime' },
    {
      name: 'a date and time in a zone',
      make: () => zoned('2026-11-14T10:30[Asia/Tokyo]'),
      expected: 'zonedDateTime',
    },
    { name: 'a year and month', make: () => month('2026-11'), expected: 'yearMonth' },
    { name: 'a month and day', make: () => Temporal.PlainMonthDay.from('11-14'), expected: null },
    {
      name: 'an instant',
      make: () => Temporal.Instant.from('2026-11-14T10:30:00Z'),
      expected: null,
    },
    { name: 'a Date', make: () => new Date(0), expected: null },
    { name: 'a text', make: () => '2026-11-14', expected: null },
    { name: 'null', make: () => null, expected: null },
    { name: 'a plain object', make: () => ({}), expected: null },
  ])('tells the kind of $name', ({ make, expected }) => {
    expect(kindOf(make())).toBe(expected);
  });

  // An object of `temporal-polyfill` is not an instance of the native class, and an object of another
  // realm is not an instance of the class of this realm. The tag is the same.
  it.each([
    { kind: 'date', make: () => Polyfill.PlainDate.from('2026-11-14') },
    { kind: 'time', make: () => Polyfill.PlainTime.from('10:30') },
    { kind: 'dateTime', make: () => Polyfill.PlainDateTime.from('2026-11-14T10:30') },
    {
      kind: 'zonedDateTime',
      make: () => Polyfill.ZonedDateTime.from('2026-11-14T10:30[Asia/Tokyo]'),
    },
    { kind: 'yearMonth', make: () => Polyfill.PlainYearMonth.from('2026-11') },
  ])('tells the kind $kind of a value that the polyfill made', ({ kind, make }) => {
    expect(kindOf(make())).toBe(kind);
  });

  it('checks one kind with isKind', () => {
    expect(isKind(day('2026-11-14'), 'date')).toBe(true);
    expect(isKind(day('2026-11-14'), 'yearMonth')).toBe(false);
    expect(isKind(null, 'date')).toBe(false);
  });
});

describe('toPlainDate and toPlainTime', () => {
  it.each([
    { name: 'a date', make: () => day('2026-11-14') },
    { name: 'a date and time', make: () => dateTime('2026-11-14T23:30') },
    { name: 'a date and time in a zone', make: () => zoned('2026-11-14T23:30[Asia/Tokyo]') },
  ])('gives the day of $name', ({ make }) => {
    expect(toPlainDate(make()).toString()).toBe('2026-11-14');
  });

  it('gives the first day of a year and month', () => {
    expect(toPlainDate(month('2026-11')).toString()).toBe('2026-11-01');
  });

  it.each([
    { name: 'a time', make: () => time('10:30:15') },
    { name: 'a date and time', make: () => dateTime('2026-11-14T10:30:15') },
    { name: 'a date and time in a zone', make: () => zoned('2026-11-14T10:30:15[Asia/Tokyo]') },
  ])('gives the time of $name', ({ make }) => {
    expect(toPlainTime(make()).toString()).toBe('10:30:15');
  });
});

describe('withDate', () => {
  it.each([
    { name: 'a date', like: () => day('2026-11-14'), expected: '2026-12-01' },
    {
      name: 'a date in a Persian calendar',
      like: () => day('2026-11-14').withCalendar('persian'),
      expected: '2026-12-01[u-ca=persian]',
    },
    {
      name: 'a date and time',
      like: () => dateTime('2026-11-14T10:30'),
      expected: '2026-12-01T10:30:00',
    },
    {
      name: 'a date and time in a Hebrew calendar',
      like: () => dateTime('2026-11-14T10:30').withCalendar('hebrew'),
      expected: '2026-12-01T10:30:00[u-ca=hebrew]',
    },
    {
      name: 'a date and time in a zone and a calendar',
      like: () => zoned('2026-11-14T10:30[America/New_York][u-ca=persian]'),
      expected: '2026-12-01T10:30:00-05:00[America/New_York][u-ca=persian]',
    },
    { name: 'a year and month', like: () => month('2026-11'), expected: '2026-12' },
    {
      name: 'a year and month in a Persian calendar',
      like: () =>
        month('2026-11').toPlainDate({ day: 1 }).withCalendar('persian').toPlainYearMonth(),
      expected: '2026-11-22[u-ca=persian]',
    },
  ])('keeps the kind, the calendar, the time and the zone of $name', ({ like, expected }) => {
    expect(withDate(like(), day('2026-12-01')).toString()).toBe(expected);
  });

  it('gives the calendar of the value to a day of another calendar', () => {
    const moved = withDate(day('2026-11-14'), day('2026-12-01').withCalendar('hebrew'));
    expect(moved.calendarId).toBe('iso8601');
    expect(moved.toString()).toBe('2026-12-01');
  });

  it('moves a time in the gap of a zone change forward', () => {
    const before = zoned('2026-03-07T02:30[America/New_York]');
    expect(withDate(before, day('2026-03-08')).toString()).toBe(
      '2026-03-08T03:30:00-04:00[America/New_York]',
    );
  });

  it('gives the same value for the same day, also in the hour that a clock repeats', () => {
    const second = zoned('2026-11-01T01:30:00-05:00[America/New_York]');
    expect(withDate(second, day('2026-11-01')).toString()).toBe(second.toString());
  });
});

describe('withTime', () => {
  it.each([
    { name: 'a time', like: () => time('10:30'), expected: '09:15:20.123456789' },
    {
      name: 'a date and time',
      like: () => dateTime('2026-11-14T10:30'),
      expected: '2026-11-14T09:15:20.123456789',
    },
    {
      name: 'a date and time in a zone and a calendar',
      like: () => zoned('2026-11-14T10:30[America/New_York][u-ca=persian]'),
      expected: '2026-11-14T09:15:20.123456789-05:00[America/New_York][u-ca=persian]',
    },
  ])('keeps the kind, the calendar, the date and the zone of $name', ({ like, expected }) => {
    expect(withTime(like(), time('09:15:20.123456789')).toString()).toBe(expected);
  });

  it('keeps the offset in the hour that a clock repeats', () => {
    const second = zoned('2026-11-01T01:30:00-05:00[America/New_York]');
    expect(withTime(second, time('01:45')).toString()).toBe(
      '2026-11-01T01:45:00-05:00[America/New_York]',
    );
  });

  it('moves a time in the gap of a zone change forward', () => {
    const before = zoned('2026-03-08T01:30:00-05:00[America/New_York]');
    expect(withTime(before, time('02:30')).toString()).toBe(
      '2026-03-08T03:30:00-04:00[America/New_York]',
    );
  });
});

describe('compareDates and isSameDay', () => {
  it.each([
    { name: 'two equal days', a: () => day('2026-11-14'), b: () => day('2026-11-14'), expected: 0 },
    {
      name: 'an earlier day',
      a: () => day('2026-11-13'),
      b: () => day('2026-11-14'),
      expected: -1,
    },
    { name: 'a later day', a: () => day('2026-11-15'), b: () => day('2026-11-14'), expected: 1 },
    {
      name: 'one day in two calendars',
      a: () => day('2026-11-14'),
      b: () => day('2026-11-14').withCalendar('hebrew'),
      expected: 0,
    },
    {
      name: 'a date and a time on the same day',
      a: () => day('2026-11-14'),
      b: () => dateTime('2026-11-14T23:59'),
      expected: 0,
    },
    {
      name: 'a zoned time, by its own day',
      a: () => zoned('2026-11-14T23:30[Asia/Tokyo]'),
      b: () => day('2026-11-14'),
      expected: 0,
    },
  ])('compares $name', ({ a, b, expected }) => {
    expect(Math.sign(compareDates(a(), b()))).toBe(expected);
    expect(isSameDay(a(), b())).toBe(expected === 0);
  });

  it('compares a year and month by its first day', () => {
    expect(compareDates(month('2026-11'), day('2026-11-02'))).toBe(-1);
    expect(compareDates(month('2026-11'), day('2026-11-01'))).toBe(0);
  });
});

describe('toInputText and parseInputText', () => {
  it.each([
    { name: 'a date', make: () => day('2026-11-14'), seconds: false, expected: '2026-11-14' },
    {
      name: 'a date in a Persian calendar',
      make: () => day('2026-11-14').withCalendar('persian'),
      seconds: false,
      expected: '2026-11-14',
    },
    { name: 'a time', make: () => time('10:30:15'), seconds: false, expected: '10:30' },
    {
      name: 'a time, with seconds',
      make: () => time('10:30:15'),
      seconds: true,
      expected: '10:30:15',
    },
    {
      name: 'a date and time',
      make: () => dateTime('2026-11-14T10:30:15'),
      seconds: false,
      expected: '2026-11-14T10:30',
    },
    {
      name: 'a date and time, with seconds',
      make: () => dateTime('2026-11-14T10:30:15'),
      seconds: true,
      expected: '2026-11-14T10:30:15',
    },
    {
      name: 'a date and time in a zone',
      make: () => zoned('2026-11-14T10:30[Asia/Tokyo]'),
      seconds: false,
      expected: '2026-11-14T10:30+09:00[Asia/Tokyo]',
    },
    {
      name: 'a date and time in a zone and a calendar',
      make: () => zoned('2026-11-14T10:30[Asia/Tokyo][u-ca=persian]'),
      seconds: false,
      expected: '2026-11-14T10:30+09:00[Asia/Tokyo]',
    },
    { name: 'a year and month', make: () => month('2026-11'), seconds: false, expected: '2026-11' },
    {
      name: 'a year and month in a Gregorian calendar',
      make: () =>
        month('2026-11').toPlainDate({ day: 1 }).withCalendar('gregory').toPlainYearMonth(),
      seconds: false,
      expected: '2026-11',
    },
    {
      name: 'a year and month in a Buddhist calendar',
      make: () =>
        month('2026-11').toPlainDate({ day: 1 }).withCalendar('buddhist').toPlainYearMonth(),
      seconds: false,
      expected: '2026-11',
    },
    {
      name: 'a year and month in a Persian calendar',
      make: () =>
        month('2026-11').toPlainDate({ day: 1 }).withCalendar('persian').toPlainYearMonth(),
      seconds: false,
      expected: '2026-10-23[u-ca=persian]',
    },
    {
      name: 'a Hebrew month that is an ISO month',
      make: () =>
        month('2027-11').toPlainDate({ day: 1 }).withCalendar('hebrew').toPlainYearMonth(),
      seconds: false,
      expected: '2027-11-01[u-ca=hebrew]',
    },
  ])('writes the text of $name', ({ make, seconds, expected }) => {
    expect(toInputText(make(), seconds)).toBe(expected);
  });

  it.each([
    { kind: 'date', text: '2026-11-14' },
    { kind: 'time', text: '10:30:15' },
    { kind: 'dateTime', text: '2026-11-14T10:30:15' },
    { kind: 'zonedDateTime', text: '2026-11-14T10:30:00+09:00[Asia/Tokyo]' },
    { kind: 'yearMonth', text: '2026-11' },
    { kind: 'yearMonth', text: '2026-10-23[u-ca=persian]' },
  ] as const)('reads $text as a value of the kind $kind', ({ kind, text }) => {
    const value = parseInputText(text, kind);
    expect(value?.toString()).toBe(text);
    expect(kindOf(value)).toBe(kind);
  });

  it.each([
    { name: 'a text that is no date', text: 'not a date', kind: 'date' },
    { name: 'a day that does not exist', text: '2026-02-30', kind: 'date' },
    { name: 'an empty text', text: '', kind: 'time' },
    { name: 'a text of another kind', text: '10:30', kind: 'date' },
    { name: 'a date and time with no zone', text: '2026-11-14T10:30', kind: 'zonedDateTime' },
    {
      name: 'a zone that does not fit the offset',
      text: '2026-11-14T10:30+08:00[Asia/Tokyo]',
      kind: 'zonedDateTime',
    },
  ] as const)('gives null for $name', ({ text, kind }) => {
    expect(parseInputText(text, kind)).toBeNull();
  });
});

describe('today', () => {
  it('gives the day in the zone that it gets', () => {
    // The two zones are 25 hours apart, so their days differ at each moment.
    const ahead = today('+14:00');
    const behind = today('-11:00');
    expect(Temporal.PlainDate.compare(ahead, behind)).toBe(1);
    expect(ahead.calendarId).toBe('iso8601');
  });
});

describe('yearMonthInCalendar', () => {
  it.each([
    { calendar: 'iso8601', year: 2026 },
    { calendar: 'gregory', year: 2026 },
    { calendar: 'buddhist', year: 2569 },
    { calendar: 'japanese', year: 2026 },
    { calendar: 'roc', year: 115 },
  ])('gives November 2026 in the calendar $calendar', ({ calendar, year }) => {
    const converted = yearMonthInCalendar(month('2026-11'), calendar);
    expect(converted?.calendarId).toBe(calendar);
    expect(converted?.year).toBe(year);
    expect(converted?.monthCode).toBe('M11');
    expect(converted?.toPlainDate({ day: 1 }).withCalendar('iso8601').toString()).toBe(
      '2026-11-01',
    );
  });

  it.each([
    {
      name: 'its own calendar, which no list names',
      make: () =>
        month('2027-11').toPlainDate({ day: 1 }).withCalendar('hebrew').toPlainYearMonth(),
      calendar: 'hebrew',
      expected: '2027-11-01[u-ca=hebrew]',
    },
    {
      name: 'a calendar id in capital letters',
      make: () => month('2026-11'),
      calendar: 'GREGORY',
      expected: '2026-11-01[u-ca=gregory]',
    },
  ])('gives the year and month in $name', ({ make, calendar, expected }) => {
    expect(yearMonthInCalendar(make(), calendar)?.toString()).toBe(expected);
  });

  it.each([
    { calendar: 'persian' },
    { calendar: 'hebrew' },
    { calendar: 'coptic' },
    { calendar: 'islamic-civil' },
  ])('gives null for the calendar $calendar, which has other months', ({ calendar }) => {
    expect(yearMonthInCalendar(month('2026-11'), calendar)).toBeNull();
  });

  it('gives null for a year and month of a calendar that has other months than the target', () => {
    const persian = month('2026-11')
      .toPlainDate({ day: 1 })
      .withCalendar('persian')
      .toPlainYearMonth();
    expect(yearMonthInCalendar(persian, 'iso8601')).toBeNull();
  });

  it.each([
    { name: 'an ISO month in hebrew', from: 'iso8601', start: '2027-11-01', to: 'hebrew' },
    { name: 'a Hebrew month in iso8601', from: 'hebrew', start: '2027-11-01', to: 'iso8601' },
    { name: 'a Persian month in indian', from: 'persian', start: '2026-04-21', to: 'indian' },
  ])('gives null for $name, also where the two months have the same days', (row) => {
    const source = day(row.start).withCalendar(row.from).toPlainYearMonth();
    const first = source.toPlainDate({ day: 1 }).withCalendar(row.to);
    const last = source.toPlainDate({ day: source.daysInMonth }).withCalendar(row.to);
    expect([first.day, last.day, first.monthCode]).toEqual([1, last.daysInMonth, last.monthCode]);

    expect(yearMonthInCalendar(source, row.to)).toBeNull();
  });

  it.each([
    { name: 'the ISO months', calendars: ['iso8601', 'gregory', 'buddhist', 'japanese', 'roc'] },
    { name: 'the Coptic months', calendars: ['coptic', 'ethiopic', 'ethioaa'] },
  ])('gives each month of 40 years in each calendar that has $name', ({ calendars }) => {
    const differentMonths: string[] = [];
    for (const from of calendars) {
      let source = day('2000-01-01').withCalendar(from).toPlainYearMonth();
      while (source.toPlainDate({ day: 1 }).withCalendar('iso8601').year < 2040) {
        for (const to of calendars) {
          const converted = yearMonthInCalendar(source, to);
          const isSame =
            converted?.calendarId === to &&
            converted.daysInMonth === source.daysInMonth &&
            converted
              .toPlainDate({ day: 1 })
              .equals(source.toPlainDate({ day: 1 }).withCalendar(to));
          if (!isSame) {
            differentMonths.push(`${source.toString()} in ${to}`);
          }
        }
        source = source.add({ months: 1 });
      }
    }
    // A wrong list makes thousands of months differ, so the failure shows only the first five.
    expect(differentMonths.slice(0, 5)).toEqual([]);
  });
});
