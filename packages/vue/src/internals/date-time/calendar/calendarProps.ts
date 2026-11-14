import type { VaseUIChangeEventDetails } from '../../createBaseUIEventDetails';
import type { REASONS } from '../../reasons';
import type { DateMatcher } from '../matchers';
import type { DateValue, DayOfWeek } from '../temporal';

export type CalendarChangeEventReason =
  typeof REASONS.dayPress | typeof REASONS.keyboard | typeof REASONS.none;

export type CalendarChangeEventDetails = VaseUIChangeEventDetails<CalendarChangeEventReason>;

/** The props that each calendar root has, whatever its selection. */
export interface CalendarBaseProps {
  /**
   * The month that the grid shows. It is the month of the first day of the page, in any
   * calendar. Use it when controlled.
   */
  month?: Temporal.PlainYearMonth | undefined;
  /**
   * The month that the grid shows when it first renders. With no value, the month of the focused
   * day, else of the selected day, else of today.
   */
  defaultMonth?: Temporal.PlainYearMonth | undefined;
  /**
   * The day that the user focused last, and that has the tab stop. It does not change `month`.
   * `null` means no such day. Use it when controlled.
   */
  focusedDate?: Temporal.PlainDate | null | undefined;
  /**
   * The day that has the tab stop when the calendar first renders.
   */
  defaultFocusedDate?: Temporal.PlainDate | null | undefined;
  /**
   * The first day of the week, from `1` for Monday to `7` for Sunday.
   * The default is the first day of the week of the locale.
   */
  firstDayOfWeek?: DayOfWeek | undefined;
  /**
   * The first day that the user can select. An earlier day is disabled.
   */
  minDate?: DateValue | undefined;
  /**
   * The last day that the user can select. A later day is disabled.
   */
  maxDate?: DateValue | undefined;
  /**
   * The days that can neither take focus nor be selected. The value is a date, a range
   * `{ start, end }`, `{ before }`, `{ after }`, `{ dayOfWeek }`, a function that gets a
   * `Temporal.PlainDate`, or a list of these.
   */
  disabledDates?: DateMatcher | undefined;
  /**
   * The days that can take focus and cannot be selected. It has the same forms as `disabledDates`.
   */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The days that have no button. It has the same forms as `disabledDates`.
   */
  hiddenDates?: DateMatcher | undefined;
  /**
   * The names of days, each with the days that it matches. A day that a modifier matches has the
   * attribute `data-<name>`, and its state has the name as a key.
   */
  modifiers?: Record<string, DateMatcher> | undefined;
  /**
   * The day that is today. The default is the day of the clock in `timeZone`.
   * Give it when a server renders the calendar, so that the server and the browser agree.
   */
  today?: DateValue | undefined;
  /**
   * The time zone in which the clock gives today. The default is the zone of the value, and then
   * the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * The locale of the names and the numbers, and of the first day of the week and the weekend.
   * The default is the runtime locale. When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar of the grid, such as `gregory` or `persian`. The default is the calendar of the
   * value when it is not ISO, and then the calendar of the locale. `gregory` turns the calendar of
   * the locale off. The value keeps its own calendar.
   */
  calendar?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a day. The days still take focus.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the value of the calendar is not valid.
   * @default false
   */
  invalid?: boolean | undefined;
  /**
   * Whether the day that has the tab stop gets focus when the calendar mounts.
   * @default false
   */
  autoFocus?: boolean | undefined;
}
