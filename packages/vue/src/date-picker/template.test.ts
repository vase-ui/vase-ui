import { describe, expect, test } from 'vitest';
import { kindOf } from '../common/date-time/temporal';
import { hasTime, templateOf } from './template';

const today = Temporal.PlainDate.from('2026-11-14');

describe('templateOf', () => {
  test.each([
    { granularity: undefined, kind: 'date' },
    { granularity: 'day', kind: 'date' },
    { granularity: 'month', kind: 'yearMonth' },
    { granularity: 'hour', kind: 'dateTime' },
    { granularity: 'minute', kind: 'dateTime' },
    { granularity: 'second', kind: 'dateTime' },
  ] as const)(
    'is a value of the kind $kind for the granularity $granularity',
    ({ granularity, kind }) => {
      expect(kindOf(templateOf(granularity, undefined, today))).toBe(kind);
    },
  );

  test('is today at midnight for a date with a time', () => {
    expect(templateOf('minute', undefined, today).toString()).toBe('2026-11-14T00:00:00');
  });

  test('is an ISO year and month for a calendar that has the months of ISO', () => {
    for (const calendar of [undefined, 'gregory', 'buddhist', 'japanese']) {
      expect(templateOf('month', calendar, today).calendarId).toBe('iso8601');
    }
  });

  // An ISO year and month does not show in a calendar that has other months.
  test.each(['persian', 'hebrew'])('is a year and month in the calendar %s', (calendar) => {
    const template = templateOf('month', calendar, today);
    expect(kindOf(template)).toBe('yearMonth');
    expect(template.calendarId).toBe(calendar);
  });

  test('is a date in the ISO calendar for a date with another calendar prop', () => {
    expect(templateOf('day', 'persian', today).calendarId).toBe('iso8601');
  });
});

describe('hasTime', () => {
  test.each([
    { name: 'a date', value: Temporal.PlainDate.from('2026-11-14'), expected: false },
    { name: 'a year and month', value: Temporal.PlainYearMonth.from('2026-11'), expected: false },
    {
      name: 'a date and time',
      value: Temporal.PlainDateTime.from('2026-11-14T15:04'),
      expected: true,
    },
    {
      name: 'a date and time in a zone',
      value: Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]'),
      expected: true,
    },
  ])('is $expected for $name', ({ value, expected }) => {
    expect(hasTime(value)).toBe(expected);
  });
});
