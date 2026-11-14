import { matches } from '../matchers';
import type { DateMatcher } from '../matchers';
import { compareDates, isSameDay } from '../temporal';
import type { DateValue, DayOfWeek } from '../temporal';
import { isInMonth } from './monthGrid';

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
   * Whether the day has no button: it is in another month than the month of its page.
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
  /** It reads the selection, so a `computed` that calls it follows the selection. */
  isSelected: (date: Temporal.PlainDate) => boolean;
}

/** The state of `date` in the page of `yearMonth`. */
export function getDayState(
  date: Temporal.PlainDate,
  yearMonth: Temporal.PlainYearMonth,
  rules: DayRules,
): DayState {
  const outsideMonth = !isInMonth(date, yearMonth);
  const isBeforeMin = rules.minDate !== undefined && compareDates(date, rules.minDate) < 0;
  const isAfterMax = rules.maxDate !== undefined && compareDates(date, rules.maxDate) > 0;
  return {
    selected: rules.isSelected(date),
    disabled: rules.disabled || isBeforeMin || isAfterMax || matches(date, rules.disabledDates),
    unavailable: matches(date, rules.unavailableDates),
    hidden: outsideMonth,
    today: isSameDay(date, rules.today),
    outsideMonth,
    weekend: rules.weekend.some((day) => day === date.dayOfWeek),
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
