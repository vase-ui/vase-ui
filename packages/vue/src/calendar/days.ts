import { matches } from '../common/date-time/matchers';
import { compareDates, isSameDay } from '../common/date-time/temporal';
import type { DateValue } from '../common/date-time/temporal';
import { isInMonth, ownsDay } from './pages';
import type { CalendarDateMatcher, CalendarDayState, CalendarPage } from './types';

/** The rules of a calendar that give the state of a day. */
export interface DayRules {
  /** `null` while the root does not know today. */
  today: Temporal.PlainDate | null;
  /** The calendar is disabled. */
  disabled: boolean;
  min: DateValue | undefined;
  max: DateValue | undefined;
  disabledDates: CalendarDateMatcher | undefined;
  unavailableDates: CalendarDateMatcher | undefined;
  hiddenDates: CalendarDateMatcher | undefined;
  modifiers: Readonly<Record<string, CalendarDateMatcher>> | undefined;
  showOutsideDays: boolean;
  /** The pages of the calendar, to find a day that two pages show. */
  pages: readonly CalendarPage[];
  /** It reads the selection, so a `computed` that calls it follows the selection. */
  isSelected: (date: Temporal.PlainDate) => boolean;
  /** The first and the last day of the range of a range root. */
  range: { start: Temporal.PlainDate; end: Temporal.PlainDate } | null;
}

/** The day takes no focus and no selection: a disabled calendar, `min`, `max` or `disabledDates`. */
export function isDisabledDay(
  date: Temporal.PlainDate,
  rules: Pick<DayRules, 'disabled' | 'min' | 'max' | 'disabledDates'>,
): boolean {
  return (
    rules.disabled ||
    (rules.min !== undefined && compareDates(date, rules.min) < 0) ||
    (rules.max !== undefined && compareDates(date, rules.max) > 0) ||
    matches(date, rules.disabledDates)
  );
}

/**
 * The state of `date` in `page`. With no page, the day is not outside a month and no other page
 * shows it, so only `hiddenDates` hides it.
 */
export function getDayState(
  date: Temporal.PlainDate,
  page: CalendarPage | null,
  rules: DayRules,
): CalendarDayState {
  const outsideMonth = page !== null && !page.isDuration && !isInMonth(date, page.yearMonth);
  // Two pages that share a day show it one time: in the page that owns it. A broadcast page with
  // fixed weeks ends with days that the next broadcast page owns.
  const ownedByOtherPage =
    page !== null &&
    !ownsDay(page, date) &&
    rules.pages.some((other) => other !== page && ownsDay(other, date));
  const disabled = isDisabledDay(date, rules);
  const unavailable = matches(date, rules.unavailableDates);
  const { range } = rules;
  const fromStart = range ? compareDates(date, range.start) : -1;
  const toEnd = range ? compareDates(date, range.end) : 1;
  return {
    // A day of a range that the user cannot select is in the range and not selected.
    selected: range
      ? fromStart >= 0 && toEnd <= 0 && !disabled && !unavailable
      : rules.isSelected(date),
    disabled,
    unavailable,
    hidden:
      (outsideMonth && !rules.showOutsideDays) ||
      ownedByOtherPage ||
      matches(date, rules.hiddenDates),
    today: rules.today !== null && isSameDay(date, rules.today),
    outsideMonth,
    rangeStart: fromStart === 0,
    rangeEnd: toEnd === 0,
    rangeMiddle: fromStart > 0 && toEnd < 0,
    modifiers: Object.fromEntries(
      Object.entries(rules.modifiers ?? {}).map(([name, matcher]) => [
        name,
        matches(date, matcher),
      ]),
    ),
  };
}

/** The day can take the focus: the keys and the tab stop skip each other day. */
export function canFocus(state: CalendarDayState): boolean {
  return !state.disabled && !state.hidden;
}

/** A press can select the day. */
export function canSelect(state: CalendarDayState): boolean {
  return canFocus(state) && !state.unavailable;
}

/**
 * The day that has the tab stop: the focused day, else the first selected day, else today, else
 * the first day. Each of them must be in `days`.
 */
export function getTabStop(
  days: readonly Temporal.PlainDate[],
  focusedDate: Temporal.PlainDate | null,
  isSelected: (date: Temporal.PlainDate) => boolean,
  today: Temporal.PlainDate | null,
): Temporal.PlainDate | null {
  return (
    (focusedDate && days.find((day) => isSameDay(day, focusedDate))) ??
    days.find(isSelected) ??
    (today && days.find((day) => isSameDay(day, today))) ??
    days[0] ??
    null
  );
}

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const DAY_ATTRIBUTES = [
  'selected',
  'disabled',
  'unavailable',
  'hidden',
  'today',
  'outside-month',
  'range-start',
  'range-end',
  'range-middle',
];

/** A modifier with the name of a day attribute would give that attribute two meanings. */
export function assertModifierNames(part: string, names: readonly string[]): void {
  for (const name of names) {
    const attribute = toKebabCase(name);
    if (DAY_ATTRIBUTES.includes(attribute)) {
      throw new Error(
        `Vase UI: The \`modifiers\` prop of <${part}> has the key \`${name}\`. ` +
          `A day uses the attribute \`data-${attribute}\` for a meaning of its own, so the attribute would have two meanings. Rename the modifier.`,
      );
    }
  }
}

/** The attributes of a day state: `data-holiday` for the modifier `holiday`. */
export function dayAttributes(state: CalendarDayState): Record<string, string | undefined> {
  const on = (value: boolean) => (value ? '' : undefined);
  const attributes: Record<string, string | undefined> = {
    'data-unavailable': on(state.unavailable),
    'data-outside-month': on(state.outsideMonth),
    'data-range-start': on(state.rangeStart),
    'data-range-end': on(state.rangeEnd),
    'data-range-middle': on(state.rangeMiddle),
  };
  for (const [name, isMatch] of Object.entries(state.modifiers)) {
    if (isMatch) attributes[`data-${toKebabCase(name)}`] = '';
  }
  return attributes;
}
