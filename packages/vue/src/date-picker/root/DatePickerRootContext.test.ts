import { describe, expect, it } from 'vitest';
import { kindOf } from '../../internals/date-time/temporal';
import { createPickerTemplate, hasTime } from './DatePickerRootContext';

describe('createPickerTemplate', () => {
  it.each([
    { granularity: undefined, kind: 'date' },
    { granularity: 'day', kind: 'date' },
    { granularity: 'month', kind: 'yearMonth' },
    { granularity: 'hour', kind: 'dateTime' },
    { granularity: 'minute', kind: 'dateTime' },
    { granularity: 'second', kind: 'dateTime' },
  ] as const)(
    'is a value of the kind $kind for the granularity $granularity',
    ({ granularity, kind }) => {
      expect(kindOf(createPickerTemplate(granularity, undefined, 'UTC'))).toBe(kind);
    },
  );

  it('is at midnight for a date with a time', () => {
    const template = createPickerTemplate('minute', undefined, 'UTC');

    expect(kindOf(template)).toBe('dateTime');
    expect((template as Temporal.PlainDateTime).toPlainTime().toString()).toBe('00:00:00');
  });

  it('is an ISO year and month for a calendar that has the months of ISO', () => {
    for (const calendar of [undefined, 'gregory', 'buddhist', 'japanese']) {
      expect(createPickerTemplate('month', calendar, 'UTC').calendarId).toBe('iso8601');
    }
  });

  // An ISO year and month does not show in a calendar that has other months.
  it.each(['persian', 'hebrew'])('is a year and month in the calendar %s', (calendar) => {
    const template = createPickerTemplate('month', calendar, 'UTC');

    expect(kindOf(template)).toBe('yearMonth');
    expect(template.calendarId).toBe(calendar);
  });

  it('is a date in the ISO calendar for a date with another calendar prop', () => {
    expect(createPickerTemplate('day', 'persian', 'UTC').calendarId).toBe('iso8601');
  });
});

describe('hasTime', () => {
  it.each([
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
