import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { digits, formatter, localeCalendar, weekInfo } from './format';

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

  it('formats the clock of a value that has no zone as it is', () => {
    const [format, epoch] = formatter(
      Temporal.PlainDateTime.from('2026-03-08T02:30'),
      { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
      'en-US',
    );
    expect(format.format(epoch)).toBe('02:30');
  });

  it('formats the clock of a value in a zone in that zone', () => {
    const [format, epoch] = formatter(
      Temporal.ZonedDateTime.from('2026-11-14T23:30[Asia/Tokyo]'),
      { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
      'en-US',
    );
    expect(format.format(epoch)).toBe('23:30');
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
    const [format, epoch] = formatter(day('2026-01-31'), { dateStyle: 'long' }, 'en-US');
    expect(format.format(epoch)).toBe('January 31, 2026');
  });

  it('formats a year and month', () => {
    const [format, epoch] = formatter(
      Temporal.PlainYearMonth.from('2026-11'),
      { month: 'long', year: 'numeric' },
      'en-US',
    );
    expect(format.format(epoch)).toBe('November 2026');
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
    'th-TH',
    'fa-IR',
    'he-IL-u-ca-hebrew',
    'en-US-u-ca-japanese',
    'en-US-u-ca-iso8601',
    'en-US-u-ca-islamicc',
    'ar-SA-u-ca-islamic',
    'en-US-u-ca-islamic-rgsa',
  ])('gives for the locale %s a calendar that Temporal accepts', (locale) => {
    const calendar = localeCalendar(locale);
    expect(Temporal.PlainDate.from('2026-11-14').withCalendar(calendar).calendarId).toBe(calendar);
  });

  it('gives the calendar of the runtime locale for no locale', () => {
    expect(localeCalendar(undefined)).toBe(new Intl.DateTimeFormat().resolvedOptions().calendar);
  });
});

describe('weekInfo', () => {
  it.each([
    { locale: 'en-US', firstDay: 7, weekend: [6, 7] },
    { locale: 'en-GB', firstDay: 1, weekend: [6, 7] },
    { locale: 'ar-EG', firstDay: 6, weekend: [5, 6] },
    { locale: 'en-US-u-fw-mon', firstDay: 1, weekend: [6, 7] },
    { locale: 'en-US-u-fw-sun', firstDay: 7, weekend: [6, 7] },
    { locale: ['xx-YY', 'en-US'], firstDay: 7, weekend: [6, 7] },
    { locale: ['en-GB', 'en-US'], firstDay: 1, weekend: [6, 7] },
    { locale: 'tlh-GB', firstDay: 1, weekend: [6, 7] },
    { locale: 'tlh-US', firstDay: 7, weekend: [6, 7] },
  ])('gives the week of the locale $locale', ({ locale, firstDay, weekend }) => {
    expect(weekInfo(locale)).toEqual({ firstDay, weekend });
  });

  it('gives the week of the runtime locale for no locale', () => {
    expect(weekInfo(undefined)).toEqual(
      weekInfo(new Intl.DateTimeFormat().resolvedOptions().locale),
    );
  });

  it('gives a locale object the week of its tag', () => {
    expect(weekInfo(new Intl.Locale('en-GB')).firstDay).toBe(1);
  });

  function mockLocale(members: object) {
    const spy = vi.spyOn(Intl, 'Locale').mockImplementation(function MockLocale() {
      return members as Intl.Locale;
    });
    onTestFinished(() => {
      spy.mockRestore();
    });
  }

  it('reads the accessor of an engine that has no method', () => {
    mockLocale({ weekInfo: { firstDay: 5, weekend: [6, 7], minimalDays: 1 } });
    expect(weekInfo('en-US')).toEqual({ firstDay: 5, weekend: [6, 7] });
  });

  it('prefers the method to the accessor', () => {
    mockLocale({
      getWeekInfo: () => ({ firstDay: 2, weekend: [6, 7] }),
      weekInfo: { firstDay: 5, weekend: [6, 7] },
    });
    expect(weekInfo('en-US').firstDay).toBe(2);
  });

  it.each([
    { name: 'an engine with no week data', members: {} },
    {
      name: 'a first day that is no day of the week',
      members: { weekInfo: { firstDay: 0, weekend: [6, 7] } },
    },
    { name: 'a weekend that is not a list', members: { weekInfo: { firstDay: 1, weekend: 6 } } },
    {
      name: 'a weekend with a day that does not exist',
      members: { weekInfo: { firstDay: 1, weekend: [6, 8] } },
    },
    { name: 'a week that is no object', members: { weekInfo: 'Monday' } },
  ])('gives the ISO week for $name', ({ members }) => {
    mockLocale(members);
    expect(weekInfo('en-US')).toEqual({ firstDay: 1, weekend: [6, 7] });
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
