import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isSameDay } from '../temporal';
import type { DateValue, DayOfWeek } from '../temporal';
import { isInMonth } from './monthGrid';
import type { CalendarPage } from './monthGrid';

export interface DayState {
  /**
   * Whether the day is in the selection.
   */
  selected: boolean;
  /**
   * Whether the day can neither take focus nor be selected: the calendar is disabled, the day is
   * before `minDate` or after `maxDate`, or `disabledDates` matches it.
   */
  disabled: boolean;
  /**
   * Whether the day can take focus and cannot be selected: `unavailableDates` matches it.
   */
  unavailable: boolean;
  /**
   * Whether the day has no button: `hiddenDates` matches it, another page owns it, or it is in
   * another month than the month of its page and `showOutsideDays` is off.
   */
  hidden: boolean;
  /**
   * Whether the day is today.
   */
  today: boolean;
  /**
   * Whether the day is in the month before or after the month of its page.
   */
  outsideMonth: boolean;
  /**
   * Whether the day is in the weekend of the locale.
   */
  weekend: boolean;
  /**
   * `true` for each modifier that matches the day, and `false` for each other modifier.
   */
  modifiers: Record<string, boolean>;
}

/** The rules of a calendar that tell the state of a day. */
export interface DayRules {
  today: Temporal.PlainDate;
  weekend: readonly DayOfWeek[];
  /** Whether the whole calendar ignores user interaction. */
  disabled: boolean;
  minDate: DateValue | undefined;
  maxDate: DateValue | undefined;
  disabledDates: DateMatcher | undefined;
  unavailableDates: DateMatcher | undefined;
  hiddenDates: DateMatcher | undefined;
  modifiers: Readonly<Record<string, DateMatcher>> | undefined;
  /** Whether a day of another month than the month of its page has a button. */
  showOutsideDays: boolean;
  /** The pages that the calendar shows, to find a day that two pages show. */
  pages: readonly CalendarPage[];
  /** It reads the selection, so a `computed` that calls it follows the selection. */
  isSelected: (date: Temporal.PlainDate) => boolean;
}

/** Whether `date` belongs to `page`, and not to the page before or after it. */
export function ownsDay(page: CalendarPage, date: Temporal.PlainDate): boolean {
  return compareDates(date, page.first) >= 0 && compareDates(date, page.last) <= 0;
}

/** The rules that disable a day. */
export type DisabledRules = Pick<DayRules, 'disabled' | 'minDate' | 'maxDate' | 'disabledDates'>;

/**
 * Whether `date` can neither take focus nor be selected: the calendar is disabled, the day is
 * before `minDate` or after `maxDate`, or `disabledDates` matches it.
 */
export function isDisabledDay(date: Temporal.PlainDate, rules: DisabledRules): boolean {
  return (
    rules.disabled ||
    (rules.minDate !== undefined && compareDates(date, rules.minDate) < 0) ||
    (rules.maxDate !== undefined && compareDates(date, rules.maxDate) > 0) ||
    matches(date, rules.disabledDates)
  );
}

/**
 * The state of `date` in `page`. With no page, the day is not outside any month and no other
 * page shows it, so only `hiddenDates` can hide it.
 */
export function getDayState(
  date: Temporal.PlainDate,
  page: CalendarPage | null,
  rules: DayRules,
): DayState {
  const outsideMonth = page !== null && !page.isDuration && !isInMonth(date, page.yearMonth);
  // Two pages that share a day show it one time: in the page that owns it. A broadcast page with
  // fixed weeks ends with days of its own month that the next broadcast page owns.
  const isOwnedByOtherPage =
    page !== null &&
    !ownsDay(page, date) &&
    rules.pages.some((other) => other !== page && ownsDay(other, date));
  return {
    selected: rules.isSelected(date),
    disabled: isDisabledDay(date, rules),
    unavailable: matches(date, rules.unavailableDates),
    hidden:
      (outsideMonth && !rules.showOutsideDays) ||
      isOwnedByOtherPage ||
      matches(date, rules.hiddenDates),
    today: isSameDay(date, rules.today),
    outsideMonth,
    weekend: rules.weekend.some((day) => day === date.dayOfWeek),
    modifiers: Object.fromEntries(
      Object.entries(rules.modifiers ?? {}).map(([name, matcher]) => [
        name,
        matches(date, matcher),
      ]),
    ),
  };
}

/** Whether a day can take focus: the keys and the tab stop skip each other day. */
export function canFocus(state: DayState): boolean {
  return !state.disabled && !state.hidden;
}

/** Whether a press can select a day. */
export function canSelect(state: DayState): boolean {
  return canFocus(state) && !state.unavailable;
}

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// The attributes that a day has without a modifier: its states, and its ISO date.
const DAY_ATTRIBUTES = [
  'selected',
  'disabled',
  'unavailable',
  'hidden',
  'today',
  'outside-month',
  'weekend',
  'date',
];
const RANGE_DAY_ATTRIBUTES = [...DAY_ATTRIBUTES, 'range-start', 'range-end', 'range-middle'];

/** A modifier with a built-in name would give the same data attribute two meanings. */
export function assertModifierNames(part: string, names: readonly string[]): void {
  const reserved = part === 'RangeCalendar.Root' ? RANGE_DAY_ATTRIBUTES : DAY_ATTRIBUTES;
  for (const name of names) {
    const attribute = toKebabCase(name);
    if (reserved.includes(attribute)) {
      throw new Error(
        `Vase UI: The \`modifiers\` prop of <${part}> has the key \`${name}\`. ` +
          `A day uses the attribute \`data-${attribute}\` for a meaning of its own, so the attribute would have two meanings. Rename the modifier.`,
      );
    }
  }
}

/** The attributes of the modifiers that match a day: `data-holiday` for `holiday`. */
export function getModifierAttributes(
  modifiers: Record<string, boolean>,
): Record<string, string> | null {
  const attributes = Object.entries(modifiers)
    .filter(([, isMatch]) => isMatch)
    .map(([name]) => [`data-${toKebabCase(name)}`, ''] as const);
  return attributes.length > 0 ? Object.fromEntries(attributes) : null;
}
