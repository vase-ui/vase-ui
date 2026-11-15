import { describe, expect, it } from 'vitest';
import { displayCalendar } from './displayCalendar';

const day = (text: string, calendar = 'iso8601') =>
  Temporal.PlainDate.from(text).withCalendar(calendar);
const month = (text: string, calendar = 'iso8601') =>
  Temporal.PlainYearMonth.from(text)
    .toPlainDate({ day: 1 })
    .withCalendar(calendar)
    .toPlainYearMonth();

describe('displayCalendar', () => {
  it.each([
    {
      name: 'the calendar option',
      calendar: 'persian',
      value: () => day('2026-11-14'),
      locale: 'en-US',
      expected: 'persian',
    },
    {
      name: 'the option, before the value calendar',
      calendar: 'hebrew',
      value: () => day('2026-11-14', 'persian'),
      locale: 'en-US',
      expected: 'hebrew',
    },
    {
      name: 'the calendar of a value that is not ISO',
      calendar: undefined,
      value: () => day('2026-11-14', 'buddhist'),
      locale: 'en-US',
      expected: 'buddhist',
    },
    {
      name: 'a Gregorian value in a Thai locale',
      calendar: undefined,
      value: () => day('2026-11-14', 'gregory'),
      locale: 'th-TH',
      expected: 'gregory',
    },
    {
      name: 'the locale calendar, for an ISO value',
      calendar: undefined,
      value: () => day('2026-11-14'),
      locale: 'th-TH',
      expected: 'buddhist',
    },
    {
      name: 'the locale calendar, for no value',
      calendar: undefined,
      value: () => null,
      locale: 'th-TH',
      expected: 'buddhist',
    },
    {
      name: 'the locale calendar, for undefined',
      calendar: undefined,
      value: () => undefined,
      locale: 'fa-IR',
      expected: 'persian',
    },
    {
      name: 'the locale calendar, for a time',
      calendar: undefined,
      value: () => Temporal.PlainTime.from('10:30'),
      locale: 'fa-IR',
      expected: 'persian',
    },
    {
      name: 'the option gregory, in a Thai locale',
      calendar: 'gregory',
      value: () => day('2026-11-14'),
      locale: 'th-TH',
      expected: 'gregory',
    },
    {
      name: 'the calendar of a zoned date and time',
      calendar: undefined,
      value: () => Temporal.ZonedDateTime.from('2026-11-14T10:30[Asia/Tokyo][u-ca=japanese]'),
      locale: 'en-US',
      expected: 'japanese',
    },
  ])('gives $name', ({ calendar, value, locale, expected }) => {
    expect(displayCalendar(calendar, value(), locale)).toBe(expected);
  });

  it.each([
    {
      name: 'the same months, from the locale',
      calendar: undefined,
      value: () => month('2026-11'),
      locale: 'th-TH',
      expected: 'buddhist',
    },
    {
      name: 'other months, from the locale',
      calendar: undefined,
      value: () => month('2026-11'),
      locale: 'fa-IR',
      expected: 'iso8601',
    },
    {
      name: 'other months, from the option',
      calendar: 'hebrew',
      value: () => month('2026-11'),
      locale: 'en-US',
      expected: 'iso8601',
    },
    {
      name: 'an ISO month that is a Hebrew month',
      calendar: 'hebrew',
      value: () => month('2027-11'),
      locale: 'en-US',
      expected: 'iso8601',
    },
    {
      name: 'the same months, from the option',
      calendar: 'japanese',
      value: () => month('2026-11'),
      locale: 'en-US',
      expected: 'japanese',
    },
    {
      name: 'a month of its own calendar',
      calendar: undefined,
      value: () => month('2026-11', 'persian'),
      locale: 'en-US',
      expected: 'persian',
    },
  ])('gives the calendar of a year and month, $name', ({ calendar, value, locale, expected }) => {
    expect(displayCalendar(calendar, value(), locale)).toBe(expected);
  });
});
