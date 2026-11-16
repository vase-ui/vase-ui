import { describe, expect, it } from 'vitest';
import {
  getMonthCells,
  getRows,
  getSpanOfYears,
  getYearCells,
  getYearPageStart,
} from './viewPages';

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
    { columns: 0, expected: [[1], [2], [3], [4], [5], [6], [7]] },
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
