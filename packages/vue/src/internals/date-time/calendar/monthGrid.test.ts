import { describe, expect, it } from 'vitest';
import type { DayOfWeek } from '../temporal';
import { getMonthPage, isInMonth, startOfWeek, weekdaysFrom } from './monthGrid';

const day = (text: string, calendar = 'iso8601') =>
  Temporal.PlainDate.from(text).withCalendar(calendar);

const text = (date: Temporal.PlainDate) => date.withCalendar('iso8601').toString();

const month = (value: string) => Temporal.PlainYearMonth.from(value);

describe('weekdaysFrom', () => {
  it.each([
    { firstDay: 1, expected: [1, 2, 3, 4, 5, 6, 7] },
    { firstDay: 3, expected: [3, 4, 5, 6, 7, 1, 2] },
    { firstDay: 7, expected: [7, 1, 2, 3, 4, 5, 6] },
  ] satisfies { firstDay: DayOfWeek; expected: DayOfWeek[] }[])(
    'starts on day $firstDay',
    ({ firstDay, expected }) => {
      expect(weekdaysFrom(firstDay)).toEqual(expected);
    },
  );
});

describe('startOfWeek', () => {
  // 2026-11-11 is a Wednesday.
  it.each([
    { name: 'Monday', firstDay: 1, expected: '2026-11-09' },
    { name: 'Sunday', firstDay: 7, expected: '2026-11-08' },
    { name: 'the day itself', firstDay: 3, expected: '2026-11-11' },
    { name: 'Thursday, which comes after the day', firstDay: 4, expected: '2026-11-05' },
  ] satisfies { name: string; firstDay: DayOfWeek; expected: string }[])(
    'gives the first day of the week that starts on $name',
    ({ firstDay, expected }) => {
      expect(text(startOfWeek(day('2026-11-11'), firstDay))).toBe(expected);
    },
  );
});

describe('getMonthPage', () => {
  // 2026-11-01 is a Sunday, and 2027-02-01 is a Monday.
  it.each([
    {
      name: 'November 2026 with Sunday first',
      month: '2026-11',
      firstDay: 7,
      start: '2026-11-01',
      end: '2026-12-05',
      weeks: 5,
    },
    {
      name: 'November 2026 with Monday first',
      month: '2026-11',
      firstDay: 1,
      start: '2026-10-26',
      end: '2026-12-06',
      weeks: 6,
    },
    {
      name: 'February 2027, four weeks, Monday first',
      month: '2027-02',
      firstDay: 1,
      start: '2027-02-01',
      end: '2027-02-28',
      weeks: 4,
    },
    {
      name: 'February 2027 with Sunday first',
      month: '2027-02',
      firstDay: 7,
      start: '2027-01-31',
      end: '2027-03-06',
      weeks: 5,
    },
  ] satisfies {
    name: string;
    month: string;
    firstDay: DayOfWeek;
    start: string;
    end: string;
    weeks: number;
  }[])('shows $name', ({ month, firstDay, start, end, weeks }) => {
    const page = getMonthPage(Temporal.PlainYearMonth.from(month), firstDay);

    expect(text(page.start)).toBe(start);
    expect(text(page.end)).toBe(end);
    expect(page.weeks).toHaveLength(weeks);
    expect(page.yearMonth.toString()).toBe(month);
  });

  it('gives each week seven days in a row, and the weeks in a row', () => {
    const page = getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 1);
    const days = page.weeks.flatMap((week) => week.days);

    expect(days).toHaveLength(42);
    expect(days.map(text)).toEqual(
      Array.from({ length: 42 }, (_, index) => text(page.start.add({ days: index }))),
    );
    for (const week of page.weeks) {
      expect(week.days[0]?.equals(week.start)).toBe(true);
    }
    expect(page.end.equals(days.at(-1)!)).toBe(true);
  });

  it('keeps each day of a week in the calendar of the month', () => {
    const page = getMonthPage(day('2026-11-14', 'persian').toPlainYearMonth(), 6);

    expect(new Set(page.weeks.flatMap((week) => week.days.map((date) => date.calendarId)))).toEqual(
      new Set(['persian']),
    );
  });

  it.each([
    { name: 'persian', date: () => day('2026-11-14', 'persian'), days: 30, first: '2026-10-23' },
    // The leap year 5784 has the month Adar I, which has 30 days.
    { name: 'hebrew', date: () => day('2024-02-10', 'hebrew'), days: 30, first: '2024-02-10' },
    { name: 'japanese', date: () => day('2019-05-20', 'japanese'), days: 31, first: '2019-05-01' },
  ])('shows the days of a month of the calendar $name', ({ date, days, first }) => {
    const yearMonth = date().toPlainYearMonth();
    const page = getMonthPage(yearMonth, 1);
    const inMonth = page.weeks
      .flatMap((week) => week.days)
      .filter((candidate) => isInMonth(candidate, yearMonth));

    expect(inMonth).toHaveLength(days);
    expect(text(inMonth[0]!)).toBe(first);
  });
});

describe('isInMonth', () => {
  it.each([
    { name: 'the first day', date: '2026-11-01', expected: true },
    { name: 'the last day', date: '2026-11-30', expected: true },
    { name: 'the day before', date: '2026-10-31', expected: false },
    { name: 'the day after', date: '2026-12-01', expected: false },
    { name: 'the same month of another year', date: '2025-11-14', expected: false },
  ])('says $expected for $name', ({ date, expected }) => {
    expect(isInMonth(day(date), Temporal.PlainYearMonth.from('2026-11'))).toBe(expected);
  });

  it('tells the two months Adar of a Hebrew leap year apart', () => {
    const adarI = day('2024-02-10', 'hebrew').toPlainYearMonth();

    expect(isInMonth(day('2024-02-10', 'hebrew'), adarI)).toBe(true);
    // The first day of Adar II, which has the month code M06.
    expect(isInMonth(day('2024-03-11', 'hebrew'), adarI)).toBe(false);
  });
});

describe('getMonthPage with fixedWeeks', () => {
  it.each([
    { name: 'a month of 4 weeks', yearMonth: '2026-02', natural: 4 },
    { name: 'a month of 5 weeks', yearMonth: '2026-11', natural: 5 },
    { name: 'a month of 6 weeks', yearMonth: '2026-08', natural: 6 },
  ])('has 6 weeks for $name', ({ yearMonth, natural }) => {
    expect(getMonthPage(month(yearMonth), 7).weeks).toHaveLength(natural);
    const page = getMonthPage(month(yearMonth), 7, true);

    expect(page.weeks).toHaveLength(6);
    expect(text(page.end)).toBe(text(page.start.add({ days: 41 })));
    expect(text(page.last)).toBe(
      text(month(yearMonth).toPlainDate({ day: month(yearMonth).daysInMonth })),
    );
  });
});
