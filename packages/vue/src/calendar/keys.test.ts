import { describe, expect, it } from 'vitest';
import { findCellTarget, findDayTarget, getCellMove, getDayMove } from './keys';
import type { CellMove } from './keys';

const day = (text: string) => Temporal.PlainDate.from(text);
const text = (date: Temporal.PlainDate | null) => date?.toString() ?? null;

type DayTargetOptions = Parameters<typeof findDayTarget>[2];
type CellTargetOptions = Parameters<typeof findCellTarget>[2];

describe('getDayMove', () => {
  it.each([
    { key: 'ArrowRight', shiftKey: false, rtl: false, expected: { days: 1 }, extend: false },
    { key: 'ArrowLeft', shiftKey: false, rtl: true, expected: { days: 1 }, extend: false },
    { key: 'ArrowDown', shiftKey: false, rtl: false, expected: { days: 7 }, extend: false },
    { key: 'PageUp', shiftKey: false, rtl: false, expected: { months: -1 }, extend: false },
    { key: 'PageDown', shiftKey: true, rtl: false, expected: { years: 1 }, extend: false },
    { key: 'ArrowRight', shiftKey: true, rtl: false, expected: { months: 1 }, extend: false },
    { key: 'ArrowUp', shiftKey: true, rtl: false, expected: { years: -1 }, extend: false },
  ])(
    'moves $expected for $key, Shift $shiftKey, rtl $rtl',
    ({ key, shiftKey, rtl, expected, extend }) => {
      const action = getDayMove(key, shiftKey, { rtl, canExtend: false });
      expect(action).toMatchObject({ move: { duration: expected }, extend });
    },
  );

  it('extends a selection that can extend with Shift and an arrow key', () => {
    expect(getDayMove('ArrowRight', true, { rtl: false, canExtend: true })).toEqual({
      move: { duration: { days: 1 }, stepDays: 1 },
      extend: true,
    });
  });

  const ltr = { rtl: false, canExtend: false };

  it.each([
    { name: 'Shift and Home', key: 'Home', shiftKey: true },
    { name: 'Enter', key: 'Enter', shiftKey: false },
    { name: 'a letter', key: 'a', shiftKey: false },
  ])('does not handle $name', ({ key, shiftKey }) => {
    expect(getDayMove(key, shiftKey, ltr)).toBe(null);
  });
});

describe('findDayTarget', () => {
  // 2026-11-13 is a Friday.
  function options(overrides: Partial<DayTargetOptions> = {}): DayTargetOptions {
    return { firstDay: 1, canFocus: () => true, min: undefined, max: undefined, ...overrides };
  }
  const disabled =
    (...dates: string[]) =>
    (date: Temporal.PlainDate) =>
      !dates.includes(date.toString());
  const find = (from: string, duration: Temporal.DurationLike, stepDays: number, rest?: object) =>
    text(findDayTarget(day(from), { duration, stepDays }, options(rest)));

  it.each([
    { name: 'a day', from: '2026-11-13', duration: { days: 1 }, step: 1, expected: '2026-11-14' },
    {
      name: 'a week',
      from: '2026-11-13',
      duration: { days: -7 },
      step: -7,
      expected: '2026-11-06',
    },
    {
      name: 'the next month',
      from: '2026-11-13',
      duration: { months: 1 },
      step: 1,
      expected: '2026-12-13',
    },
    {
      name: 'a year',
      from: '2026-11-13',
      duration: { years: -1 },
      step: -1,
      expected: '2025-11-13',
    },
  ])('moves $name', ({ from, duration, step, expected }) => {
    expect(find(from, duration, step)).toBe(expected);
  });

  it.each([
    { name: 'January 31 to February 28', from: '2026-01-31', months: 1, expected: '2026-02-28' },
    {
      name: 'March 31 back to February 28',
      from: '2026-03-31',
      months: -1,
      expected: '2026-02-28',
    },
    { name: 'a leap day to the next year', from: '2028-02-29', months: 12, expected: '2029-02-28' },
  ])('moves a month to the last day of a shorter month: $name', ({ from, months, expected }) => {
    expect(find(from, { months }, Math.sign(months))).toBe(expected);
  });

  it.each([
    {
      name: 'a weekend to Monday',
      from: '2026-11-13',
      duration: { days: 1 },
      step: 1,
      expected: '2026-11-16',
    },
    {
      name: 'a weekend back to Friday',
      from: '2026-11-16',
      duration: { days: -1 },
      step: -1,
      expected: '2026-11-13',
    },
    {
      name: 'the same weekday of a week that is off',
      from: '2026-11-10',
      duration: { days: 7 },
      step: 7,
      // 2026-11-17 is off, so the search goes on by a week.
      expected: '2026-11-24',
      off: ['2026-11-17'],
    },
    {
      name: 'a month that lands on a day that is off',
      from: '2026-10-14',
      duration: { months: 1 },
      step: 1,
      expected: '2026-11-17',
      off: ['2026-11-14', '2026-11-15', '2026-11-16'],
    },
  ])('goes on in its direction over days that cannot take focus: $name', (row) => {
    const off = row.off ?? ['2026-11-14', '2026-11-15'];

    expect(find(row.from, row.duration, row.step, { canFocus: disabled(...off) })).toBe(
      row.expected,
    );
  });

  it.each([
    { name: 'before the least day', from: '2026-11-10', days: -1, expected: null },
    { name: 'after the greatest day', from: '2026-11-20', days: 1, expected: null },
    { name: 'inside the limits', from: '2026-11-11', days: 1, expected: '2026-11-12' },
  ])('stops at the limits: $name', ({ from, days, expected }) => {
    const limits = { min: day('2026-11-10'), max: day('2026-11-20') };

    expect(find(from, { days }, days, limits)).toBe(expected);
  });

  it.each([
    {
      name: 'a month back to the least day',
      from: '2026-11-18',
      months: -1,
      expected: '2026-11-10',
    },
    {
      name: 'a month on to the greatest day',
      from: '2026-11-12',
      months: 1,
      expected: '2026-11-20',
    },
  ])('moves to the limit when a move passes it: $name', ({ from, months, expected }) => {
    const limits = { min: day('2026-11-10'), max: day('2026-11-20') };

    expect(find(from, { months }, Math.sign(months), limits)).toBe(expected);
  });

  it('stays when a day that cannot take focus is the limit', () => {
    expect(
      find('2026-11-12', { days: -1 }, -1, {
        min: day('2026-11-10'),
        canFocus: disabled('2026-11-11', '2026-11-10'),
      }),
    ).toBe(null);
  });

  it('stops when no day can take focus', () => {
    expect(find('2026-11-12', { days: 1 }, 1, { canFocus: () => false })).toBe(null);
  });

  describe('the edge of a week', () => {
    const edge = (weekEdge: 'start' | 'end', from: string, rest?: Partial<DayTargetOptions>) =>
      text(findDayTarget(day(from), { weekEdge }, options(rest)));

    // The week of 2026-11-11 is 2026-11-09 to 2026-11-15, with Monday first.
    it.each([
      { name: 'the first day', weekEdge: 'start', expected: '2026-11-09' },
      { name: 'the last day', weekEdge: 'end', expected: '2026-11-15' },
    ] as const)('goes to $name of the week', ({ weekEdge, expected }) => {
      expect(edge(weekEdge, '2026-11-11')).toBe(expected);
    });

    it('goes to the first day of a week that starts on Sunday', () => {
      expect(edge('start', '2026-11-11', { firstDay: 7 })).toBe('2026-11-08');
    });

    it('goes to the day that is nearest to the edge and can take focus', () => {
      const canFocus = disabled('2026-11-09', '2026-11-10', '2026-11-15');

      expect(edge('start', '2026-11-13', { canFocus })).toBe('2026-11-11');
      expect(edge('end', '2026-11-12', { canFocus })).toBe('2026-11-14');
    });

    it('stays on the first day that can take focus', () => {
      expect(edge('start', '2026-11-11', { canFocus: disabled('2026-11-09', '2026-11-10') })).toBe(
        null,
      );
      expect(edge('end', '2026-11-15')).toBe(null);
    });
  });
});

const month = (value: string) => Temporal.PlainYearMonth.from(value);

const months: CellTargetOptions = {
  unit: 'month',
  columns: 3,
  visibleYears: 12,
  canFocus: () => true,
  min: undefined,
  max: undefined,
};

const years: CellTargetOptions = { ...months, unit: 'year' };

function target(from: string, move: CellMove, options: CellTargetOptions = months) {
  return findCellTarget(month(from), move, options)?.toString() ?? null;
}

describe('getCellMove', () => {
  it.each([
    { key: 'ArrowRight', rtl: false, expected: { cells: 1 } },
    { key: 'ArrowLeft', rtl: false, expected: { cells: -1 } },
    { key: 'ArrowRight', rtl: true, expected: { cells: -1 } },
    { key: 'ArrowLeft', rtl: true, expected: { cells: 1 } },
    { key: 'ArrowDown', rtl: false, expected: { cells: 4 } },
    { key: 'ArrowUp', rtl: true, expected: { cells: -4 } },
    { key: 'Home', rtl: false, expected: { rowEdge: 'start' } },
    { key: 'End', rtl: true, expected: { rowEdge: 'end' } },
    { key: 'PageDown', rtl: true, expected: { pages: 1 } },
    { key: 'PageUp', rtl: false, expected: { pages: -1 } },
    { key: 'a', rtl: false, expected: null },
    { key: 'Tab', rtl: false, expected: null },
  ])('gives $expected for $key, rtl $rtl', ({ key, rtl, expected }) => {
    expect(getCellMove(key, { rtl, columns: 4 })).toEqual(expected);
  });
});

describe('findCellTarget in a grid of months', () => {
  it.each([
    { name: 'the next month', from: '2026-11', move: { cells: 1 }, expected: '2026-12' },
    { name: 'the next year', from: '2026-12', move: { cells: 1 }, expected: '2027-01' },
    { name: 'the year before', from: '2026-01', move: { cells: -1 }, expected: '2025-12' },
    { name: 'a row down', from: '2026-11', move: { cells: 3 }, expected: '2027-02' },
    { name: 'a row up', from: '2026-02', move: { cells: -3 }, expected: '2025-11' },
    {
      name: 'the same month a year after',
      from: '2026-05',
      move: { pages: 1 },
      expected: '2027-05',
    },
    {
      name: 'the same month a year before',
      from: '2026-05',
      move: { pages: -1 },
      expected: '2025-05',
    },
    {
      name: 'the start of the row',
      from: '2026-05',
      move: { rowEdge: 'start' },
      expected: '2026-04',
    },
    { name: 'the end of the row', from: '2026-05', move: { rowEdge: 'end' }, expected: '2026-06' },
    {
      name: 'no move from the start of its row',
      from: '2026-04',
      move: { rowEdge: 'start' },
      expected: null,
    },
    {
      name: 'no move from the end of its row',
      from: '2026-12',
      move: { rowEdge: 'end' },
      expected: null,
    },
  ] satisfies { name: string; from: string; move: CellMove; expected: string | null }[])(
    'gives $name',
    ({ from, move, expected }) => {
      expect(target(from, move)).toBe(expected);
    },
  );

  it('ends the last row of a year of 13 months with that month', () => {
    const hebrew = Temporal.PlainYearMonth.from({ year: 5787, month: 11, calendar: 'hebrew' });

    const end = findCellTarget(hebrew, { rowEdge: 'end' }, months);

    expect(end?.month).toBe(12);
    expect(findCellTarget(end!.add({ months: 1 }), { rowEdge: 'start' }, months)).toBeNull();
  });

  it('goes on in the direction of the move to the next month that can take focus', () => {
    const canFocus = (cell: Temporal.PlainYearMonth) =>
      !['2026-12', '2027-01'].includes(cell.toString());

    expect(target('2026-11', { cells: 1 }, { ...months, canFocus })).toBe('2027-02');
    expect(target('2027-02', { cells: -1 }, { ...months, canFocus })).toBe('2026-11');
    expect(target('2026-11', { pages: 1 }, { ...months, canFocus })).toBe('2027-11');
  });

  it('stops the edge of a row at the first month of the row that can take focus', () => {
    const canFocus = (cell: Temporal.PlainYearMonth) => cell.month !== 4;

    expect(target('2026-06', { rowEdge: 'start' }, { ...months, canFocus })).toBe('2026-05');
  });

  it.each([
    {
      name: 'a move past the last month',
      from: '2026-11',
      move: { cells: 3 },
      expected: '2026-12',
    },
    { name: 'a move from the last month', from: '2026-12', move: { cells: 1 }, expected: null },
    {
      name: 'a move past the first month',
      from: '2026-03',
      move: { cells: -3 },
      expected: '2026-02',
    },
    { name: 'a move from the first month', from: '2026-02', move: { cells: -1 }, expected: null },
  ] satisfies { name: string; from: string; move: CellMove; expected: string | null }[])(
    'stops at the limits: $name',
    ({ from, move, expected }) => {
      expect(target(from, move, { ...months, min: month('2026-02'), max: month('2026-12') })).toBe(
        expected,
      );
    },
  );

  it('gives no target when no month can take focus', () => {
    expect(target('2026-11', { cells: 1 }, { ...months, canFocus: () => false })).toBeNull();
    expect(target('2026-11', { pages: 1 }, { ...months, canFocus: () => false })).toBeNull();
  });
});

describe('findCellTarget in a grid of years', () => {
  // The page that holds 2026 has the years 2016 to 2027, in four rows of three.
  it.each([
    { name: 'the next year', from: '2026-01', move: { cells: 1 }, expected: '2027-01' },
    {
      name: 'the first year of the next page',
      from: '2027-01',
      move: { cells: 1 },
      expected: '2028-01',
    },
    {
      name: 'the last year of the page before',
      from: '2016-01',
      move: { cells: -1 },
      expected: '2015-01',
    },
    { name: 'a row down', from: '2026-01', move: { cells: 3 }, expected: '2029-01' },
    {
      name: 'the same place in the next page',
      from: '2026-01',
      move: { pages: 1 },
      expected: '2038-01',
    },
    {
      name: 'the same place in the page before',
      from: '2026-01',
      move: { pages: -1 },
      expected: '2014-01',
    },
    {
      name: 'the start of the row',
      from: '2026-01',
      move: { rowEdge: 'start' },
      expected: '2025-01',
    },
    { name: 'the end of the row', from: '2026-01', move: { rowEdge: 'end' }, expected: '2027-01' },
  ] satisfies { name: string; from: string; move: CellMove; expected: string | null }[])(
    'gives $name',
    ({ from, move, expected }) => {
      expect(target(from, move, years)).toBe(expected);
    },
  );

  it('stops at the year of a limit, whatever the month of the limit', () => {
    const limits = { ...years, min: month('2020-06'), max: month('2030-03') };

    expect(target('2021-01', { cells: -3 }, limits)).toBe('2020-01');
    expect(target('2029-01', { cells: 3 }, limits)).toBe('2030-01');
    expect(target('2030-01', { cells: 1 }, limits)).toBeNull();
  });

  it('goes on to the next year that can take focus', () => {
    const canFocus = (cell: Temporal.PlainYearMonth) => cell.year !== 2027 && cell.year !== 2028;

    expect(target('2026-01', { cells: 1 }, { ...years, canFocus })).toBe('2029-01');
  });
});
