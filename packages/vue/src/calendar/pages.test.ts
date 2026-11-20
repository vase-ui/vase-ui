import { describe, expect, it } from 'vitest';
import type { DayOfWeek } from '../internals/date-time/temporal';
import {
  alignPageStart,
  getBroadcastPage,
  getDurationPage,
  getMonthCells,
  getMonthPage,
  getRows,
  getSpanOfYears,
  getWeekNumber,
  getYearCells,
  getYearPageStart,
  isInMonth,
  startOfWeek,
  weekdaysFrom,
} from './pages';

const day = (value: string, calendar = 'iso8601') =>
  Temporal.PlainDate.from(value).withCalendar(calendar);

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
    const page = getMonthPage(Temporal.PlainYearMonth.from(month), firstDay, false);

    expect(text(page.start)).toBe(start);
    expect(text(page.end)).toBe(end);
    expect(page.weeks).toHaveLength(weeks);
    expect(page.yearMonth.toString()).toBe(month);
  });

  it('gives each week seven days in a row, and the weeks in a row', () => {
    const page = getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 1, false);
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
    const page = getMonthPage(day('2026-11-14', 'persian').toPlainYearMonth(), 6, false);

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
    const page = getMonthPage(yearMonth, 1, false);
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
    expect(getMonthPage(month(yearMonth), 7, false).weeks).toHaveLength(natural);
    const page = getMonthPage(month(yearMonth), 7, true);

    expect(page.weeks).toHaveLength(6);
    expect(text(page.end)).toBe(text(page.start.add({ days: 41 })));
    expect(text(page.last)).toBe(
      text(month(yearMonth).toPlainDate({ day: month(yearMonth).daysInMonth })),
    );
  });
});

describe('getMonthCells', () => {
  it('gives the 12 months of the year of a month, in order', () => {
    const cells = getMonthCells(Temporal.PlainYearMonth.from('2026-11'));

    expect(cells.map((cell) => cell.toString())).toEqual(
      Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`),
    );
  });

  it.each([
    { name: 'a leap year', year: 5787, count: 13 },
    { name: 'a year with no leap month', year: 5786, count: 12 },
  ])('gives the months of a Hebrew year: $name', ({ year, count }) => {
    const first = Temporal.PlainYearMonth.from({ year, month: 1, calendar: 'hebrew' });

    const cells = getMonthCells(first);

    expect(cells).toHaveLength(count);
    expect(cells.every((cell) => cell.calendarId === 'hebrew' && cell.year === year)).toBe(true);
  });
});

describe('getYearPageStart', () => {
  it.each([
    { year: 2026, count: 12, expected: 2016 },
    { year: 2016, count: 12, expected: 2016 },
    { year: 2027, count: 12, expected: 2016 },
    { year: 2028, count: 12, expected: 2028 },
    { year: 2026, count: 5, expected: 2025 },
    { year: -1, count: 12, expected: -12 },
    { year: 2026, count: 1, expected: 2026 },
  ])('starts the page of $year, $count years, with $expected', ({ year, count, expected }) => {
    expect(getYearPageStart(year, count)).toBe(expected);
  });
});

describe('getYearCells', () => {
  it('gives the first month of each year of the page that holds a month', () => {
    const cells = getYearCells(Temporal.PlainYearMonth.from('2026-11'), 12);

    expect(cells.map((cell) => cell.toString())).toEqual(
      Array.from({ length: 12 }, (_, index) => `${2016 + index}-01`),
    );
  });

  it('keeps the calendar of the month', () => {
    const persian = Temporal.PlainDate.from('2026-11-14')
      .withCalendar('persian')
      .toPlainYearMonth();

    const cells = getYearCells(persian, 3);

    expect(cells.map((cell) => cell.calendarId)).toEqual(['persian', 'persian', 'persian']);
    expect(cells.map((cell) => cell.month)).toEqual([1, 1, 1]);
  });
});

describe('getRows', () => {
  it.each([
    { columns: 3, expected: [[1, 2, 3], [4, 5, 6], [7]] },
    { columns: 7, expected: [[1, 2, 3, 4, 5, 6, 7]] },
    { columns: 1, expected: [[1], [2], [3], [4], [5], [6], [7]] },
  ])('splits 7 cells in rows of $columns', ({ columns, expected }) => {
    expect(getRows([1, 2, 3, 4, 5, 6, 7], columns)).toEqual(expected);
  });
});

describe('getSpanOfYears', () => {
  it('gives the first day of the first year and the last day of the last year', () => {
    const span = getSpanOfYears(
      Temporal.PlainYearMonth.from('2016-01'),
      Temporal.PlainYearMonth.from('2027-01'),
    );

    expect([span.first.toString(), span.last.toString()]).toEqual(['2016-01-01', '2027-12-31']);
  });

  it('ends a Hebrew leap year with its 13th month', () => {
    const leap = Temporal.PlainYearMonth.from({ year: 5787, month: 1, calendar: 'hebrew' });

    const { first, last } = getSpanOfYears(leap, leap);

    const nextYear = Temporal.PlainDate.from({ year: 5788, month: 1, day: 1, calendar: 'hebrew' });
    expect(
      first.equals(Temporal.PlainDate.from({ year: 5787, month: 1, day: 1, calendar: 'hebrew' })),
    ).toBe(true);
    expect(last.add({ days: 1 }).equals(nextYear)).toBe(true);
  });
});

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
    const page = getBroadcastPage(month(yearMonth), false);

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
    const pages = ['2026-10', '2026-11', '2026-12'].map((value) => getBroadcastPage(month(value), false));

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
