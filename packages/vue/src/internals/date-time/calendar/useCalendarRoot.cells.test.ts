import { describe, expect, it } from 'vitest';
import { findGridTarget, getGridMove } from './useCalendarRoot';
import type { GridMove, GridTargetOptions } from './useCalendarRoot';

const month = (text: string) => Temporal.PlainYearMonth.from(text);

const months: GridTargetOptions = {
  unit: 'month',
  columns: 3,
  visibleYears: 12,
  canFocus: () => true,
  min: undefined,
  max: undefined,
};

const years: GridTargetOptions = { ...months, unit: 'year' };

function target(from: string, move: GridMove, options: GridTargetOptions = months) {
  return findGridTarget(month(from), move, options)?.toString() ?? null;
}

describe('getGridMove', () => {
  it.each([
    { key: 'ArrowRight', isRtl: false, expected: { cells: 1 } },
    { key: 'ArrowLeft', isRtl: false, expected: { cells: -1 } },
    { key: 'ArrowRight', isRtl: true, expected: { cells: -1 } },
    { key: 'ArrowLeft', isRtl: true, expected: { cells: 1 } },
    { key: 'ArrowDown', isRtl: false, expected: { cells: 4 } },
    { key: 'ArrowUp', isRtl: true, expected: { cells: -4 } },
    { key: 'Home', isRtl: false, expected: { rowEdge: 'start' } },
    { key: 'End', isRtl: true, expected: { rowEdge: 'end' } },
    { key: 'PageDown', isRtl: true, expected: { pages: 1 } },
    { key: 'PageUp', isRtl: false, expected: { pages: -1 } },
    { key: 'a', isRtl: false, expected: null },
    { key: 'Tab', isRtl: false, expected: null },
  ])('gives $expected for $key, rtl $isRtl', ({ key, isRtl, expected }) => {
    expect(getGridMove(key, { isRtl, columns: 4 })).toEqual(expected);
  });
});

describe('findGridTarget in a grid of months', () => {
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
  ] satisfies { name: string; from: string; move: GridMove; expected: string | null }[])(
    'gives $name',
    ({ from, move, expected }) => {
      expect(target(from, move)).toBe(expected);
    },
  );

  it('ends the last row of a year of 13 months with that month', () => {
    const hebrew = Temporal.PlainYearMonth.from({ year: 5787, month: 11, calendar: 'hebrew' });

    const end = findGridTarget(hebrew, { rowEdge: 'end' }, months);

    expect(end?.month).toBe(12);
    expect(findGridTarget(end!.add({ months: 1 }), { rowEdge: 'start' }, months)).toBeNull();
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
  ] satisfies { name: string; from: string; move: GridMove; expected: string | null }[])(
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

describe('findGridTarget in a grid of years', () => {
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
  ] satisfies { name: string; from: string; move: GridMove; expected: string | null }[])(
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
