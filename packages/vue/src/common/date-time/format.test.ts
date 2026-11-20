import { describe, expect, it } from 'vitest';
import { digits, formatter, localeCalendar } from './format';

const day = (text: string) => Temporal.PlainDate.from(text);

describe('formatter', () => {
  it.each([
    {
      name: 'a date',
      value: () => day('2026-11-14'),
      epoch: Date.UTC(2026, 10, 14),
      timeZone: 'UTC',
      calendar: 'gregory',
    },
    {
      name: 'a date in a Persian calendar',
      value: () => day('2026-11-14').withCalendar('persian'),
      epoch: Date.UTC(2026, 10, 14),
      timeZone: 'UTC',
      calendar: 'persian',
    },
    {
      name: 'a date and time of a zone gap',
      value: () => Temporal.PlainDateTime.from('2026-03-08T02:30'),
      epoch: Date.UTC(2026, 2, 8, 2, 30),
      timeZone: 'UTC',
      calendar: 'gregory',
    },
    {
      name: 'a date and time in a zone',
      value: () => Temporal.ZonedDateTime.from('2026-11-14T23:30[Asia/Tokyo]'),
      epoch: Date.UTC(2026, 10, 14, 14, 30),
      timeZone: 'Asia/Tokyo',
      calendar: 'gregory',
    },
    {
      name: 'a date and time in a zone and a calendar',
      value: () =>
        Temporal.ZonedDateTime.from('2026-11-14T23:30[Asia/Tokyo]').withCalendar('hebrew'),
      epoch: Date.UTC(2026, 10, 14, 14, 30),
      timeZone: 'Asia/Tokyo',
      calendar: 'hebrew',
    },
    {
      name: 'a time',
      value: () => Temporal.PlainTime.from('15:05:30.123'),
      epoch: Date.UTC(1970, 0, 1, 15, 5, 30, 123),
      timeZone: 'UTC',
      calendar: undefined,
    },
    {
      name: 'a year and month',
      value: () => Temporal.PlainYearMonth.from('2026-11'),
      epoch: Date.UTC(2026, 10, 1),
      timeZone: 'UTC',
      calendar: 'gregory',
    },
  ])('gives Intl the number, the zone and the calendar of $name', (row) => {
    const [format, epoch] = formatter(row.value(), {}, 'en-US');
    expect(epoch).toBe(row.epoch);
    expect(format.resolvedOptions().timeZone).toBe(row.timeZone);
    if (row.calendar) {
      expect(format.resolvedOptions().calendar).toBe(row.calendar);
    }
  });

  const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;

  it('formats the clock of a value that has no zone as it is', () => {
    const expected = new Intl.DateTimeFormat('en-US', { ...clock, timeZone: 'UTC' }).format(
      Date.UTC(2026, 2, 8, 2, 30),
    );
    const [format, epoch] = formatter(
      Temporal.PlainDateTime.from('2026-03-08T02:30'),
      clock,
      'en-US',
    );
    expect(format.format(epoch)).toBe(expected);
  });

  it('formats the clock of a value in a zone in that zone', () => {
    const expected = new Intl.DateTimeFormat('en-US', { ...clock, timeZone: 'Asia/Tokyo' }).format(
      Date.UTC(2026, 10, 14, 14, 30),
    );
    const [format, epoch] = formatter(
      Temporal.ZonedDateTime.from('2026-11-14T23:30[Asia/Tokyo]'),
      clock,
      'en-US',
    );
    expect(format.format(epoch)).toBe(expected);
  });

  it('formats a date in its calendar with the words of the locale', () => {
    const options = { month: 'long', year: 'numeric' } as const;
    const expected = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: 'UTC',
      calendar: 'persian',
    }).format(Date.UTC(2026, 10, 14));
    const [format, epoch] = formatter(day('2026-11-14').withCalendar('persian'), options, 'en-US');
    expect(format.format(epoch)).toBe(expected);
    expect(expected).toContain('1405');
  });

  it('formats an ISO date as a Gregorian date', () => {
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeZone: 'UTC',
      calendar: 'gregory',
    }).format(Date.UTC(2026, 0, 31));
    const [format, epoch] = formatter(day('2026-01-31'), { dateStyle: 'long' }, 'en-US');
    expect(format.format(epoch)).toBe(expected);
  });

  it('formats a year and month', () => {
    const options = { month: 'long', year: 'numeric' } as const;
    const expected = new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: 'UTC',
      calendar: 'gregory',
    }).format(Date.UTC(2026, 10, 1));
    const [format, epoch] = formatter(Temporal.PlainYearMonth.from('2026-11'), options, 'en-US');
    expect(format.format(epoch)).toBe(expected);
  });

  it.each([
    { name: 'a date', value: () => day('2026-11-14'), timeZone: 'UTC', calendar: 'gregory' },
    {
      name: 'a zoned date and time',
      value: () => Temporal.ZonedDateTime.from('2026-11-14T10:30[Asia/Tokyo]'),
      timeZone: 'Asia/Tokyo',
      calendar: 'gregory',
    },
    { name: 'a time', value: () => Temporal.PlainTime.from('10:30'), timeZone: 'UTC' },
  ])('replaces the zone and the calendar of the options with those of $name', (row) => {
    const [format] = formatter(
      row.value(),
      { timeZone: 'America/New_York', calendar: 'persian' },
      'en-US',
    );
    expect(format.resolvedOptions().timeZone).toBe(row.timeZone);
    if (row.calendar) {
      expect(format.resolvedOptions().calendar).toBe(row.calendar);
    }
  });
});

describe('localeCalendar', () => {
  it.each([
    { locale: 'en-US', expected: 'gregory' },
    { locale: 'th-TH', expected: 'buddhist' },
    { locale: 'fa-IR', expected: 'persian' },
    { locale: 'en-US-u-ca-hebrew', expected: 'hebrew' },
    { locale: ['xx-YY', 'th-TH'], expected: 'buddhist' },
  ])('gives $expected for the locale $locale', ({ locale, expected }) => {
    expect(localeCalendar(locale)).toBe(expected);
  });

  it.each([
    { locale: 'th-TH' },
    { locale: 'fa-IR' },
    { locale: 'he-IL-u-ca-hebrew' },
    { locale: 'en-US-u-ca-japanese' },
    { locale: 'en-US-u-ca-iso8601' },
    { locale: 'en-US-u-ca-islamicc' },
    { locale: 'ar-SA-u-ca-islamic' },
    { locale: 'en-US-u-ca-islamic-rgsa' },
  ])('gives for the locale $locale a calendar that Temporal accepts', ({ locale }) => {
    const calendar = localeCalendar(locale);
    expect(Temporal.PlainDate.from('2026-11-14').withCalendar(calendar).calendarId).toBe(calendar);
  });

  it('gives the calendar of the runtime locale for no locale', () => {
    expect(localeCalendar(undefined)).toBe(new Intl.DateTimeFormat().resolvedOptions().calendar);
  });
});

describe('digits', () => {
  it.each([
    { locale: 'en-US', expected: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    { locale: 'ar-EG-u-nu-latn', expected: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    { locale: 'ar-EG-u-nu-arab', expected: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] },
    { locale: 'fa-IR-u-nu-arabext', expected: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] },
    { locale: 'hi-IN-u-nu-deva', expected: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] },
  ])('gives the digits of the locale $locale', ({ locale, expected }) => {
    expect(digits(locale)).toEqual(expected);
  });
});
