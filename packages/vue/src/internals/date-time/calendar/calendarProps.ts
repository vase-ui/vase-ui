import type { VaseUIChangeEventDetails } from '../../createBaseUIEventDetails';
import type { REASONS } from '../../reasons';
import type { DateMatcher } from '../matchers';
import type { DateValue, DayOfWeek } from '../temporal';
import type { VisibleDuration } from './weeks';

/** The reasons that each calendar root has, whatever its selection and its views. */
export type CalendarBaseChangeEventReason =
  | typeof REASONS.dayPress
  | typeof REASONS.keyboard
  | typeof REASONS.monthChange
  | typeof REASONS.none;

/** The reasons that only a calendar with the views of months and years has. */
export type CalendarViewChangeEventReason =
  typeof REASONS.monthPress | typeof REASONS.yearPress | typeof REASONS.triggerPress;

export type CalendarChangeEventReason =
  CalendarBaseChangeEventReason | CalendarViewChangeEventReason;

export type CalendarBaseChangeEventDetails =
  VaseUIChangeEventDetails<CalendarBaseChangeEventReason>;
export type CalendarChangeEventDetails = VaseUIChangeEventDetails<CalendarChangeEventReason>;

/** What a calendar can select: a day, or a year and month. */
export type CalendarValue = DateValue | Temporal.PlainYearMonth;

/** What the grid shows: the days of a month, the months of a year, or a page of years. */
export type CalendarView = 'day' | 'month' | 'year';

/** The props of a calendar that has the views of months and years. */
export interface CalendarViewProps {
  /**
   * What the grid shows: `day` the days of the months, `month` the months of a year, and `year` a
   * page of years. A value that is a year and month has no days, so its first view is `month`.
   * A calendar with `visibleDuration` shows days only. Use it when controlled.
   */
  view?: CalendarView | undefined;
  /**
   * What the grid shows when it first renders. The default is `day`, and `month` for a value that is
   * a year and month.
   */
  defaultView?: CalendarView | undefined;
  /**
   * The number of years on a page of years. A page starts with a year that is a multiple of this
   * number, so the page that holds 2026 starts with 2016 when the number is 12.
   * @default 12
   */
  visibleYears?: number | undefined;
  /**
   * Whether a month cannot take focus and cannot be selected. The function gets each month of the
   * grid, in the calendar of the grid. A month before `minDate` or after `maxDate` is disabled too.
   */
  disabledMonths?: ((month: Temporal.PlainYearMonth) => boolean) | undefined;
  /**
   * Whether a year cannot take focus and cannot be selected. The function gets the first month of
   * each year of the grid, in the calendar of the grid. A year before `minDate` or after `maxDate`
   * is disabled too.
   */
  disabledYears?: ((year: Temporal.PlainYearMonth) => boolean) | undefined;
}

/** The props that each calendar root has, whatever its selection. */
export interface CalendarBaseProps {
  /**
   * The month that the grid shows. With `numberOfMonths`, it is the first month. With
   * `visibleDuration`, the page starts on a day of this month, or with the week that holds its
   * first day, and a move of the page gives the month of its first day. A month or year select can
   * start the page earlier, so that the page ends with the week or the day of `maxDate`. When the
   * grid has another calendar than this month, the grid shows the month that holds the first day of
   * this month. The grid of months shows the year of this month, and the grid of years shows the
   * page of years that holds that year. Use it when controlled.
   */
  month?: Temporal.PlainYearMonth | undefined;
  /**
   * The month that the grid shows when it first renders, as `month` describes it. With no value, the
   * month of the focused day, else of the selected day, else of today. The root applies `minDate`
   * and `maxDate` to that month, as it does for a move of the page. It shows a value of this prop
   * as it is.
   */
  defaultMonth?: Temporal.PlainYearMonth | undefined;
  /**
   * The day that the user focused last, and that has the tab stop. `null` means no such day. When
   * it changes to a day that no page of the grid shows or holds, the grid shows the page of that
   * day. For a day outside `minDate` and `maxDate`, it shows the page of the limit. When that page
   * is in another month, the root emits `monthChange`. With a controlled `month`, the page moves
   * when the consumer gives that month. Use it when controlled.
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
   * month that owns it. A press on a day that no month of the grid owns shows its month.
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
   * The first day that the user can select. An earlier day is disabled. A page that the root picks
   * or moves to does not start before the page of this day, unless `maxDate` does not allow it.
   */
  minDate?: DateValue | undefined;
  /**
   * The last day that the user can select. A later day is disabled. A page that the root picks or
   * moves to does not end after the page of this day. This rule wins over `minDate`.
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
   * A server render and the hydration show the day of the clock of the server. After the mount, the
   * calendar shows the day of the clock of the browser. Give `today` when the server knows the day
   * of the visitor.
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
