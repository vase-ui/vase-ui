import { describe, expect, it } from 'vitest';
import {
  alignPageStart,
  getBroadcastPage,
  getDurationPage,
  getWeekNumber,
} from './useCalendarRoot';

const day = (text: string) => Temporal.PlainDate.from(text);
const month = (text: string) => Temporal.PlainYearMonth.from(text);
const text = (date: Temporal.PlainDate) => date.toString();

describe('getWeekNumber', () => {
  it.each([
    {
      name: 'the last week of 2026, by ISO',
      date: '2026-12-28',
      firstDay: 1,
      minimalDays: 4,
      week: 53,
    },
    {
      name: 'the first week of 2027, by ISO',
      date: '2027-01-04',
      firstDay: 1,
      minimalDays: 4,
      week: 1,
    },
    {
      name: 'a day inside the last ISO week',
      date: '2027-01-03',
      firstDay: 1,
      minimalDays: 4,
      week: 53,
    },
    {
      name: 'a week of 2020 that has 53 weeks, by ISO',
      date: '2020-12-31',
      firstDay: 1,
      minimalDays: 4,
      week: 53,
    },
    {
      name: 'the week of January 1, from Sunday',
      date: '2026-12-27',
      firstDay: 7,
      minimalDays: 1,
      week: 1,
    },
    {
      name: 'the next week, from Sunday',
      date: '2027-01-03',
      firstDay: 7,
      minimalDays: 1,
      week: 2,
    },
    {
      name: 'a week of November, from Sunday',
      date: '2026-11-08',
      firstDay: 7,
      minimalDays: 1,
      week: 46,
    },
    {
      name: 'a day in the middle of a week',
      date: '2026-11-11',
      firstDay: 7,
      minimalDays: 1,
      week: 46,
    },
    {
      name: 'the first full week, from Monday',
      date: '2026-01-05',
      firstDay: 1,
      minimalDays: 7,
      week: 1,
    },
    {
      name: 'a week before the first full week',
      date: '2026-01-04',
      firstDay: 1,
      minimalDays: 7,
      week: 52,
    },
  ])('gives $name: $week', ({ date, firstDay, minimalDays, week }) => {
    expect(getWeekNumber(day(date), firstDay as 1 | 7, minimalDays)).toBe(week);
  });

  it('gives the number of the ISO date to a day of another calendar', () => {
    expect(getWeekNumber(day('2026-11-28').withCalendar('persian'), 1, 4)).toBe(48);
  });
});

describe('getBroadcastPage', () => {
  it.each([
    {
      name: 'a month that starts on a Sunday',
      yearMonth: '2026-11',
      start: '2026-10-26',
      weeks: 5,
      last: '2026-11-29',
    },
    {
      name: 'a month that starts on a Monday',
      yearMonth: '2027-02',
      start: '2027-02-01',
      weeks: 4,
      last: '2027-02-28',
    },
    {
      name: 'a month that has 4 weeks',
      yearMonth: '2026-10',
      start: '2026-09-28',
      weeks: 4,
      last: '2026-10-25',
    },
    {
      name: 'the first month of a year',
      yearMonth: '2027-01',
      start: '2026-12-28',
      weeks: 5,
      last: '2027-01-31',
    },
  ])('has the weeks of $name', ({ yearMonth, start, weeks, last }) => {
    const page = getBroadcastPage(month(yearMonth));

    expect(text(page.start)).toBe(start);
    expect(page.weeks).toHaveLength(weeks);
    expect(page.weeks.every((week) => week.start.dayOfWeek === 1)).toBe(true);
    expect(text(page.first)).toBe(start);
    expect(text(page.last)).toBe(last);
    expect(text(page.end)).toBe(last);
    expect(page.weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(page.isDuration).toBe(false);
  });

  it('gives each day to one page of the months in a row', () => {
    const pages = ['2026-10', '2026-11', '2026-12'].map((value) => getBroadcastPage(month(value)));

    expect(pages.map((page) => [text(page.first), text(page.last)])).toEqual([
      ['2026-09-28', '2026-10-25'],
      ['2026-10-26', '2026-11-29'],
      ['2026-11-30', '2026-12-27'],
    ]);
  });

  it('gives 5 weeks with fixedWeeks, and keeps the days that belong to the month', () => {
    const page = getBroadcastPage(month('2026-10'), true);

    expect(page.weeks).toHaveLength(5);
    expect(text(page.end)).toBe('2026-11-01');
    expect(text(page.last)).toBe('2026-10-25');
  });
});

describe('getDurationPage', () => {
  it('has whole weeks', () => {
    const page = getDurationPage(day('2026-11-08'), { weeks: 2 }, month('2026-11'));

    expect(page.weeks.map((week) => text(week.start))).toEqual(['2026-11-08', '2026-11-15']);
    expect(text(page.start)).toBe('2026-11-08');
    expect(text(page.end)).toBe('2026-11-21');
    expect(text(page.last)).toBe('2026-11-21');
    expect(page.weekdays).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(page.isDuration).toBe(true);
    expect(page.yearMonth.toString()).toBe('2026-11');
  });

  it('has the days of one row, from the first day', () => {
    const page = getDurationPage(day('2026-11-12'), { days: 5 }, month('2026-11'));

    expect(page.weeks).toHaveLength(1);
    expect(page.weeks[0]!.days.map(text)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
    expect(text(page.end)).toBe('2026-11-16');
    expect(page.weekdays).toEqual([4, 5, 6, 7, 1]);
  });
});

describe('alignPageStart', () => {
  it.each([
    { name: 'weeks, forward', duration: { weeks: 2 }, edge: 'start', expected: '2026-11-08' },
    { name: 'weeks, backward', duration: { weeks: 2 }, edge: 'end', expected: '2026-11-01' },
    { name: 'days, forward', duration: { days: 5 }, edge: 'start', expected: '2026-11-11' },
    { name: 'days, backward', duration: { days: 5 }, edge: 'end', expected: '2026-11-07' },
  ] as const)('gives the first day for $name', ({ duration, edge, expected }) => {
    // 2026-11-11 is a Wednesday, and the weeks start on Sunday.
    expect(text(alignPageStart(day('2026-11-11'), duration, 7, edge))).toBe(expected);
  });

  it('shows the day in the page that starts there', () => {
    const duration = { weeks: 2 };
    for (const edge of ['start', 'end'] as const) {
      const start = alignPageStart(day('2026-11-11'), duration, 7, edge);
      const page = getDurationPage(start, duration, month('2026-11'));

      expect(page.weeks.some((week) => week.days.some((item) => text(item) === '2026-11-11'))).toBe(
        true,
      );
    }
  });
});
