import { describe, expect, it } from 'vitest';
import {
  assertModifierNames,
  canFocus,
  canSelect,
  getDayState,
  getModifierAttributes,
} from './dayState';
import type { DayRules } from './dayState';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday.
function rules(overrides: Partial<DayRules> = {}): DayRules {
  return {
    today: day('2026-11-14'),
    weekend: [6, 7],
    disabled: false,
    minDate: undefined,
    maxDate: undefined,
    disabledDates: undefined,
    unavailableDates: undefined,
    hiddenDates: undefined,
    modifiers: undefined,
    isSelected: () => false,
    ...overrides,
  };
}

const november = () => Temporal.PlainYearMonth.from('2026-11');

describe('getDayState', () => {
  it('says that a day of an ordinary calendar has no state', () => {
    expect(getDayState(day('2026-11-11'), november(), rules())).toEqual({
      selected: false,
      disabled: false,
      unavailable: false,
      hidden: false,
      today: false,
      outsideMonth: false,
      weekend: false,
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
    { name: 'Saturday', date: '2026-11-14', key: 'weekend', expected: true },
    { name: 'Sunday', date: '2026-11-15', key: 'weekend', expected: true },
    { name: 'Friday', date: '2026-11-13', key: 'weekend', expected: false },
  ])('gives $key for $name', ({ date, key, expected }) => {
    expect(getDayState(day(date), november(), rules())).toMatchObject({ [key]: expected });
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
        name: 'a day before minDate',
        date: '2026-11-09',
        props: { minDate: day('2026-11-10') },
        expected: true,
      },
      {
        name: 'minDate itself',
        date: '2026-11-10',
        props: { minDate: day('2026-11-10') },
        expected: false,
      },
      {
        name: 'a day after maxDate',
        date: '2026-11-21',
        props: { maxDate: day('2026-11-20') },
        expected: true,
      },
      {
        name: 'maxDate itself',
        date: '2026-11-20',
        props: { maxDate: day('2026-11-20') },
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
        name: 'a zoned maxDate, by its own day',
        date: '2026-11-15',
        props: { maxDate: Temporal.ZonedDateTime.from('2026-11-14T23:30[America/New_York]') },
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
    weekend: false,
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
  ])('refuses the state name %s', (name) => {
    expect(() => {
      assertModifierNames('Calendar.Root', { [name]: day('2026-11-11') });
    }).toThrow(/^Vase UI: The `modifiers` prop of <Calendar.Root> has the key `/);
  });

  it('accepts other names, and no modifiers', () => {
    expect(() => {
      assertModifierNames('Calendar.Root', { holiday: day('2026-11-11'), selectedByTeam: [] });
      assertModifierNames('Calendar.Root', undefined);
    }).not.toThrow();
  });

  it.each<{
    name: string;
    modifiers: Record<string, boolean>;
    expected: Record<string, string> | null;
  }>([
    { name: 'a lower case name', modifiers: { holiday: true }, expected: { 'data-holiday': '' } },
    {
      name: 'a camel case name',
      modifiers: { isHoliday: true, work: false },
      expected: { 'data-is-holiday': '' },
    },
    { name: 'no true modifier', modifiers: { holiday: false }, expected: null },
    { name: 'no modifier', modifiers: {}, expected: null },
  ])('gives the attributes for $name', ({ modifiers, expected }) => {
    expect(getModifierAttributes(modifiers)).toEqual(expected);
  });
});
