import { describe, expect, it } from 'vitest';
import { assertModifierNames, canFocus, canSelect, dayAttributes, getDayState, getTabStop } from './days';
import type { DayRules } from './days';
import { getBroadcastPage, getDurationPage, getMonthPage, ownsDay } from './pages';
import type { CalendarDayState } from './types';

const day = (value: string) => Temporal.PlainDate.from(value);
const text = (date: Temporal.PlainDate | null) => date?.toString() ?? null;

// 2026-11-14 is a Saturday.
function rules(overrides: Partial<DayRules> = {}): DayRules {
  return {
    today: day('2026-11-14'),
    disabled: false,
    min: undefined,
    max: undefined,
    disabledDates: undefined,
    unavailableDates: undefined,
    hiddenDates: undefined,
    modifiers: undefined,
    showOutsideDays: false,
    pages: [],
    isSelected: () => false,
    range: null,
    ...overrides,
  };
}

// The weeks start on Sunday, as in `en-US`.
const november = () => getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 7, false);

describe('getDayState', () => {
  it('says that a day of an ordinary calendar has no state', () => {
    expect(getDayState(day('2026-11-11'), november(), rules())).toEqual({
      selected: false,
      disabled: false,
      unavailable: false,
      hidden: false,
      today: false,
      outsideMonth: false,
      rangeStart: false,
      rangeEnd: false,
      rangeMiddle: false,
      modifiers: {},
    });
  });

  it('reads the selection from the rules', () => {
    const state = getDayState(
      day('2026-11-11'),
      november(),
      rules({ isSelected: (date) => date.day === 11 }),
    );

    expect(state.selected).toBe(true);
    expect(getDayState(day('2026-11-12'), november(), rules()).selected).toBe(false);
  });

  it.each([
    { name: 'today', date: '2026-11-14', key: 'today', expected: true },
    { name: 'another day', date: '2026-11-13', key: 'today', expected: false },
  ])('gives $key for $name', ({ date, key, expected }) => {
    expect(getDayState(day(date), november(), rules())).toMatchObject({ [key]: expected });
  });

  it('gives no day today while the root does not know today', () => {
    expect(getDayState(day('2026-11-14'), november(), rules({ today: null })).today).toBe(false);
  });

  it('gives the range states, and no selection to a day of the range that the user cannot select', () => {
    const range = { start: day('2026-11-10'), end: day('2026-11-12') };
    const options = rules({ range, unavailableDates: day('2026-11-11') });
    const state = (date: string) => {
      const { selected, rangeStart, rangeMiddle, rangeEnd } = getDayState(day(date), november(), options);
      return { selected, rangeStart, rangeMiddle, rangeEnd };
    };
    expect(state('2026-11-10')).toEqual({ selected: true, rangeStart: true, rangeMiddle: false, rangeEnd: false });
    expect(state('2026-11-11')).toEqual({ selected: false, rangeStart: false, rangeMiddle: true, rangeEnd: false });
    expect(state('2026-11-12')).toEqual({ selected: true, rangeStart: false, rangeMiddle: false, rangeEnd: true });
    expect(state('2026-11-13').selected).toBe(false);
  });

  it.each([
    { name: 'a day of the month', date: '2026-11-30', expected: false },
    { name: 'a day of the month before', date: '2026-10-31', expected: true },
    { name: 'a day of the month after', date: '2026-12-01', expected: true },
  ])('says that $name is outside the month: $expected', ({ date, expected }) => {
    const state = getDayState(day(date), november(), rules());

    expect(state.outsideMonth).toBe(expected);
    expect(state.hidden).toBe(expected);
  });

  describe('disabled', () => {
    it.each([
      { name: 'the whole calendar', date: '2026-11-11', props: { disabled: true }, expected: true },
      {
        name: 'a day before min',
        date: '2026-11-09',
        props: { min: day('2026-11-10') },
        expected: true,
      },
      {
        name: 'min itself',
        date: '2026-11-10',
        props: { min: day('2026-11-10') },
        expected: false,
      },
      {
        name: 'a day after max',
        date: '2026-11-21',
        props: { max: day('2026-11-20') },
        expected: true,
      },
      {
        name: 'max itself',
        date: '2026-11-20',
        props: { max: day('2026-11-20') },
        expected: false,
      },
      {
        name: 'a day of disabledDates',
        date: '2026-11-11',
        props: { disabledDates: day('2026-11-11') },
        expected: true,
      },
      {
        name: 'a weekend day that a matcher names',
        date: '2026-11-14',
        props: { disabledDates: { dayOfWeek: [6, 7] } },
        expected: true,
      },
      {
        name: 'a zoned max, by its own day',
        date: '2026-11-15',
        props: { max: Temporal.ZonedDateTime.from('2026-11-14T23:30[America/New_York]') },
        expected: true,
      },
    ])('gives $expected for $name', ({ date, props, expected }) => {
      expect(getDayState(day(date), november(), rules(props)).disabled).toBe(expected);
    });
  });

  it('gives a day that unavailableDates matches focus and no selection', () => {
    const state = getDayState(
      day('2026-11-11'),
      november(),
      rules({ unavailableDates: [day('2026-11-11')] }),
    );

    expect(state).toMatchObject({ unavailable: true, disabled: false, hidden: false });
    expect(canFocus(state)).toBe(true);
    expect(canSelect(state)).toBe(false);
  });

  it('hides a day that hiddenDates matches', () => {
    const state = getDayState(
      day('2026-11-11'),
      november(),
      rules({ hiddenDates: { before: day('2026-11-12') } }),
    );

    expect(state.hidden).toBe(true);
    expect(canFocus(state)).toBe(false);
  });

  it('gives each modifier a boolean', () => {
    const modifiers = { holiday: day('2026-11-11'), weekendDay: { dayOfWeek: [6, 7] } };

    expect(getDayState(day('2026-11-11'), november(), rules({ modifiers })).modifiers).toEqual({
      holiday: true,
      weekendDay: false,
    });
    expect(getDayState(day('2026-11-14'), november(), rules({ modifiers })).modifiers).toEqual({
      holiday: false,
      weekendDay: true,
    });
  });
});

describe('canFocus and canSelect', () => {
  const base = {
    selected: false,
    today: false,
    outsideMonth: false,
    rangeStart: false,
    rangeEnd: false,
    rangeMiddle: false,
    modifiers: {},
  };

  it.each([
    { name: 'an ordinary day', state: {}, focus: true, select: true },
    { name: 'a disabled day', state: { disabled: true }, focus: false, select: false },
    { name: 'a hidden day', state: { hidden: true }, focus: false, select: false },
    { name: 'an unavailable day', state: { unavailable: true }, focus: true, select: false },
  ])('allows focus: $focus, and selection: $select, for $name', ({ state, focus, select }) => {
    const full = { ...base, disabled: false, unavailable: false, hidden: false, ...state };

    expect(canFocus(full)).toBe(focus);
    expect(canSelect(full)).toBe(select);
  });
});

describe('modifier names', () => {
  it.each([
    'selected',
    'disabled',
    'unavailable',
    'hidden',
    'today',
    'outsideMonth',
    'outside-month',
    'rangeStart',
    'range-end',
    'rangeMiddle',
  ])('refuses the name of an attribute of a day: %s', (name) => {
    expect(() => {
      assertModifierNames('Calendar.Root', [name]);
    }).toThrow(/^Vase UI: The `modifiers` prop of <Calendar.Root> has the key `/);
  });

  it('accepts other names, and no modifiers', () => {
    expect(() => {
      assertModifierNames('Calendar.Root', ['holiday', 'selectedByTeam', 'weekend', 'date']);
      assertModifierNames('Calendar.Root', []);
    }).not.toThrow();
  });

  it('gives the attributes of a state, with a kebab case name for each modifier that matches', () => {
    const state: CalendarDayState = {
      selected: true,
      disabled: false,
      unavailable: true,
      hidden: false,
      today: true,
      outsideMonth: true,
      rangeStart: true,
      rangeEnd: false,
      rangeMiddle: false,
      modifiers: { isHoliday: true, work: false },
    };
    expect(dayAttributes(state)).toEqual({
      'data-unavailable': '',
      'data-outside-month': '',
      'data-range-start': '',
      'data-range-end': undefined,
      'data-range-middle': undefined,
      'data-is-holiday': '',
    });
  });
});

describe('outside days', () => {
  const december = () => getMonthPage(Temporal.PlainYearMonth.from('2026-12'), 7, false);
  const shown = { showOutsideDays: true };

  it.each([
    { name: 'off', props: {}, hidden: true },
    { name: 'on', props: shown, hidden: false },
  ])('hides a day of another month when showOutsideDays is $name: $hidden', ({ props, hidden }) => {
    const state = getDayState(day('2026-12-02'), november(), rules(props));

    expect(state.outsideMonth).toBe(true);
    expect(state.hidden).toBe(hidden);
  });

  it('shows a day that two pages hold only in the page that owns it', () => {
    // The last week of the November page and the first week of the December page both have the days
    // from 2026-11-29 to 2026-12-05.
    const pages = [november(), december()];
    const options = rules({ ...shown, pages });

    expect(getDayState(day('2026-12-02'), pages[0]!, options).hidden).toBe(true);
    expect(getDayState(day('2026-12-02'), pages[1]!, options).hidden).toBe(false);
    expect(getDayState(day('2026-11-30'), pages[1]!, options).hidden).toBe(true);
    expect(getDayState(day('2026-11-30'), pages[0]!, options).hidden).toBe(false);
  });

  it('shows a day of the month before when no other page holds it', () => {
    const pages = [december()];

    expect(getDayState(day('2026-11-30'), pages[0]!, rules({ ...shown, pages })).hidden).toBe(
      false,
    );
  });

  it('gives the broadcast page the days of the weeks around its month, as outside days', () => {
    // The broadcast page of November 2026 has the weeks from Monday October 26 to Sunday November 29.
    const pages = [getBroadcastPage(Temporal.PlainYearMonth.from('2026-11'), false)];
    const state = (date: string, props: Partial<DayRules>) =>
      getDayState(day(date), pages[0]!, rules({ pages, ...props }));

    expect(state('2026-10-28', shown)).toMatchObject({ outsideMonth: true, hidden: false });
    expect(state('2026-10-28', { showOutsideDays: false })).toMatchObject({ hidden: true });
    expect(ownsDay(pages[0]!, day('2026-10-26'))).toBe(true);
    expect(ownsDay(pages[0]!, day('2026-11-30'))).toBe(false);
  });

  it('has no day outside a page of weeks or days', () => {
    const page = getDurationPage(day('2026-11-29'), { weeks: 2 }, november().yearMonth);

    expect(getDayState(day('2026-12-05'), page, rules())).toMatchObject({
      outsideMonth: false,
      hidden: false,
    });
  });

  it.each([
    { name: 'the first day', date: '2026-11-01', expected: true },
    { name: 'the last day', date: '2026-11-30', expected: true },
    { name: 'a day of the week of the month before', date: '2026-10-31', expected: false },
    { name: 'a day after the month', date: '2026-12-01', expected: false },
  ])('says that the November page owns $name: $expected', ({ date, expected }) => {
    expect(ownsDay(november(), day(date))).toBe(expected);
  });
});

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
    const tabStop = getTabStop(days(), focusedDate === null ? null : day(focusedDate), (date) => selected.includes(date.toString()), day(today));

    expect(text(tabStop)).toBe(expected);
  });

  it('gives no day when no day can take focus', () => {
    expect(
      getTabStop([], day('2026-11-11'), none, day('2026-11-11')),
    ).toBe(null);
  });

  it('compares a focused day in another calendar by the day', () => {
    const tabStop = getTabStop(days(), day('2026-11-11').withCalendar('persian'), none, day('2026-11-09'));

    expect(text(tabStop)).toBe('2026-11-11');
  });

  it('does not use today while the root does not know it', () => {
    expect(text(getTabStop(days(), null, none, null))).toBe('2026-11-09');
  });
});
