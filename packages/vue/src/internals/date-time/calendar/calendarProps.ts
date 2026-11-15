import type { VaseUIChangeEventDetails } from '../../createBaseUIEventDetails';
import type { REASONS } from '../../reasons';
import type { DateMatcher } from '../matchers';
import type { DateValue, DayOfWeek } from '../temporal';
import type { VisibleDuration } from './weeks';

export type CalendarChangeEventReason =
  | typeof REASONS.dayPress
  | typeof REASONS.keyboard
  | typeof REASONS.monthChange
  | typeof REASONS.none;

export type CalendarChangeEventDetails = VaseUIChangeEventDetails<CalendarChangeEventReason>;

/** The props that each calendar root has, whatever its selection. */
export interface CalendarBaseProps {
  /**
   * The month that the grid shows. With `numberOfMonths`, it is the first month. With
   * `visibleDuration`, it is the month of the first day of the page. When the grid has another
   * calendar than this month, the grid shows the month that holds the first day of this month.
   * Use it when controlled.
   */
  month?: Temporal.PlainYearMonth | undefined;
  /**
   * The month that the grid shows when it first renders, as `month` describes it. With no value, the
   * month of the focused day, else of the selected day, else of today.
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
   * The number of months that the grid shows at one time, one after the other.
   * @default 1
   */
  numberOfMonths?: number | undefined;
  /**
   * Whether the two navigation buttons move by `numberOfMonths` months. Without it, they move by
   * one month.
   * @default false
   */
  pagedNavigation?: boolean | undefined;
  /**
   * Whether each month has the same number of weeks, so that the grid has the same height in each
   * month: six weeks, and five weeks with `broadcastCalendar`.
   * @default false
   */
  fixedWeeks?: boolean | undefined;
  /**
   * Whether the days of the months around a month have a button. The default is `false`, and `true`
   * with `broadcastCalendar`. Two months of the grid that share a day show it one time, in the
   * month of the day. A press on a day that no month of the grid owns shows its month.
   */
  showOutsideDays?: boolean | undefined;
  /**
   * The first day of the week, from `1` for Monday to `7` for Sunday.
   * The default is the first day of the week of the locale.
   */
  firstDayOfWeek?: DayOfWeek | undefined;
  /**
   * Whether the weeks follow ISO 8601: they start on Monday and have their ISO number.
   * `firstDayOfWeek` and `firstWeekContainsDate` do not apply.
   * @default false
   */
  isoWeek?: boolean | undefined;
  /**
   * The day of January that is always in the first week of the year, from `1` to `7`. The default
   * is `4` for weeks that start on Monday, which gives the ISO 8601 number of the week, and `1` for
   * the other weeks.
   */
  firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;
  /**
   * Whether the grid shows the broadcast calendar. Its weeks start on Monday, and a month has the
   * 4 or 5 weeks from the Monday of the week that holds its first day. It needs the Gregorian
   * calendar.
   * @default false
   */
  broadcastCalendar?: boolean | undefined;
  /**
   * Shows one page of whole weeks, `{ weeks: 2 }`, or one row of days, `{ days: 5 }`, in place of
   * a month. The navigation buttons move by the duration. A key that moves the focus out of the page
   * shows the page that holds the day. `numberOfMonths` and `fixedWeeks` do not apply.
   */
  visibleDuration?: VisibleDuration | undefined;
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
