import { describe, expect, it } from 'vitest';
import { findKeyTarget, getKeyAction, getTabStop } from './useCalendarRoot';
import type { KeyTargetOptions } from './useCalendarRoot';

const day = (text: string) => Temporal.PlainDate.from(text);
const text = (date: Temporal.PlainDate | null) => date?.toString() ?? null;

describe('getTabStop', () => {
  const days = () =>
    ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map(day);
  const none = () => false;

  it.each([
    {
      name: 'the focused day',
      focusedDate: '2026-11-11',
      selected: ['2026-11-10'],
      today: '2026-11-12',
      expected: '2026-11-11',
    },
    {
      name: 'the selected day, focus not in days',
      focusedDate: '2026-12-01',
      selected: ['2026-11-10'],
      today: '2026-11-12',
      expected: '2026-11-10',
    },
    {
      name: 'the first selected day in the grid',
      focusedDate: null,
      selected: ['2026-11-12', '2026-11-10'],
      today: '2026-11-13',
      expected: '2026-11-10',
    },
    {
      name: 'today, when no day is selected',
      focusedDate: null,
      selected: [],
      today: '2026-11-12',
      expected: '2026-11-12',
    },
    {
      name: 'the first day, today not in the days',
      focusedDate: null,
      selected: [],
      today: '2026-12-01',
      expected: '2026-11-09',
    },
  ])('gives $name', ({ focusedDate, selected, today, expected }) => {
    const tabStop = getTabStop({
      days: days(),
      focusedDate: focusedDate === null ? null : day(focusedDate),
      isSelected: (date) => selected.includes(date.toString()),
      today: day(today),
    });

    expect(text(tabStop)).toBe(expected);
  });

  it('gives no day when no day can take focus', () => {
    expect(
      getTabStop({
        days: [],
        focusedDate: day('2026-11-11'),
        isSelected: none,
        today: day('2026-11-11'),
      }),
    ).toBe(null);
  });

  it('compares a focused day in another calendar by the day', () => {
    const tabStop = getTabStop({
      days: days(),
      focusedDate: day('2026-11-11').withCalendar('persian'),
      isSelected: none,
      today: day('2026-11-09'),
    });

    expect(text(tabStop)).toBe('2026-11-11');
  });
});

describe('getKeyAction', () => {
  const ltr = { isRtl: false, canExtend: false };

  it.each([
    { name: 'Shift and Home', key: 'Home', shiftKey: true },
    { name: 'Enter', key: 'Enter', shiftKey: false },
    { name: 'a letter', key: 'a', shiftKey: false },
  ])('does not handle $name', ({ key, shiftKey }) => {
    expect(getKeyAction(key, shiftKey, ltr)).toBe(null);
  });
});

describe('findKeyTarget', () => {
  // 2026-11-13 is a Friday.
  function options(overrides: Partial<KeyTargetOptions> = {}): KeyTargetOptions {
    return { firstDay: 1, canFocus: () => true, min: undefined, max: undefined, ...overrides };
  }
  const disabled =
    (...dates: string[]) =>
    (date: Temporal.PlainDate) =>
      !dates.includes(date.toString());
  const find = (from: string, duration: Temporal.DurationLike, stepDays: number, rest?: object) =>
    text(findKeyTarget(day(from), { duration, stepDays }, options(rest)));

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
    const edge = (weekEdge: 'start' | 'end', from: string, rest?: Partial<KeyTargetOptions>) =>
      text(findKeyTarget(day(from), { weekEdge }, options(rest)));

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
