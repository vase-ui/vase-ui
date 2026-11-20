/// <reference lib="esnext.temporal" preserve="true" />
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { DateMatcher } from '../common/date-time/matchers';
import type { DateValue, DayOfWeek } from '../common/date-time/temporal';

/** What a calendar selects: a day, or a year and month. */
export type CalendarValue = DateValue | Temporal.PlainYearMonth;

/** What the grid shows: the days of the months, the months of a year, or a page of years. */
export type CalendarRootView = 'day' | 'month' | 'year';

/**
 * A rule for the days of a grid. Each form but the function and the list compares by the day:
 * - a date matches that day;
 * - `{ start, end }` matches the days from `start` to `end`, the two ends included;
 * - `{ before }` and `{ after }` match the days before or after that day;
 * - `{ before, after }` matches the days between the two, the two ends excluded;
 * - `{ dayOfWeek }` matches each day of the week that it names, from Monday (1) to Sunday (7);
 * - a function matches the days for which it returns `true`;
 * - a list matches the days that one of its rules matches.
 */
export type CalendarDateMatcher = DateMatcher;

/**
 * - `day-press`, `month-press`, `year-press`: a press on a day, a month cell or a year cell.
 * - `trigger-press`: a press on `Calendar.ViewTrigger`.
 * - `month-change`: a press on a navigation button, or a change of a select.
 * - `keyboard`: a key in a grid.
 * - `none`: a day or a cell got the focus.
 */
export type CalendarRootChangeEventReason =
  | 'day-press'
  | 'month-press'
  | 'year-press'
  | 'trigger-press'
  | 'month-change'
  | 'keyboard'
  | 'none';

export type CalendarRootChangeEventDetails = ChangeEventDetails<CalendarRootChangeEventReason>;

/** The seven days of a row of a page, from the first day of the week. */
export interface CalendarWeek {
  start: Temporal.PlainDate;
  days: Temporal.PlainDate[];
}

/**
 * The weeks that a calendar shows at one time. The first and the last week of a month can hold days
 * of the months around it. All dates are in the calendar of the grid.
 */
export interface CalendarPage {
  /** The first day of the first week. */
  start: Temporal.PlainDate;
  /** The last day of the last week. */
  end: Temporal.PlainDate;
  /** The first day that belongs to the page. The days before it belong to the page before. */
  first: Temporal.PlainDate;
  /** The last day that belongs to the page. The days after it belong to the page after. */
  last: Temporal.PlainDate;
  /**
   * The month of the page. A page of weeks or days has the month of the root: the month of its
   * first day, or the month whose first day is in its first week.
   */
  yearMonth: Temporal.PlainYearMonth;
  /** The page is a duration of weeks or days. Such a page has no day outside its month. */
  isDuration: boolean;
  /** The day of the week of each column, in the order of the first row. */
  weekdays: DayOfWeek[];
  weeks: CalendarWeek[];
}

/** The weeks or the days that one page shows in place of a month. */
export type CalendarVisibleDuration = { weeks: number } | { days: number };

export interface CalendarState {
  /** The user cannot change the calendar, and no part of it takes the focus. */
  disabled: boolean;
  /** The user cannot select a day or a month. The days still take the focus. */
  readonly: boolean;
  /** The value of the calendar is not valid. */
  invalid: boolean;
  /** No day and no month is selected. */
  empty: boolean;
}

export interface CalendarRootState extends CalendarState {
  /** What the grid shows. */
  view: CalendarRootView;
  /** The grid shows more than one month. */
  multipleMonths: boolean;
  /** The side of the last move of the first month: `none` until it moves, and after a view change. */
  navigationDirection: 'previous' | 'next' | 'none';
  /** The grid shows the broadcast calendar. */
  broadcastCalendar: boolean;
}

/** The props that `Calendar.Root` and `RangeCalendar.Root` share. */
export interface CalendarBaseProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The first month of the page. `v-model:month` binds it. The root shows it as it is, also when
   * it is out of `min` and `max`.
   */
  month?: Temporal.PlainYearMonth | undefined;
  /**
   * The first month of the page at the mount of an uncontrolled month. With none, the page holds
   * the focused day, else the first value, else today, and keeps to `min` and `max`.
   */
  defaultMonth?: Temporal.PlainYearMonth | undefined;
  /**
   * The day that the user focused last. It has the tab stop. `null` is no such day.
   * `v-model:focusedDate` binds it. A new day that the page does not show moves the page.
   */
  focusedDate?: Temporal.PlainDate | null | undefined;
  /** The focused day at the mount of an uncontrolled focused day. */
  defaultFocusedDate?: Temporal.PlainDate | null | undefined;
  /**
   * The number of months that the page shows.
   * @default 1
   */
  numberOfMonths?: number | undefined;
  /**
   * The navigation buttons move by `numberOfMonths` months, and not by one month.
   * @default false
   */
  pagedNavigation?: boolean | undefined;
  /**
   * Each month has six weeks, and five weeks with `broadcastCalendar`, so the grid keeps its height.
   * @default false
   */
  fixedWeeks?: boolean | undefined;
  /**
   * The days of the months around a month have a button. The default is `false`, and `true` with
   * `broadcastCalendar`. Two months of the page that share a day show it one time.
   */
  showOutsideDays?: boolean | undefined;
  /**
   * The first day of the week, from `1` for Monday to `7` for Sunday. The default is the first
   * day in the region of the locale, as CLDR gives it: `7` for `en-US`, `1` for `de-DE`. A locale
   * with no region takes its likely region. The broadcast calendar always starts on Monday.
   */
  firstDayOfWeek?: DayOfWeek | undefined;
  /**
   * The day of January that is always in week 1, from `1` to `7`. The default is `4` for weeks
   * that start on Monday, which gives the ISO 8601 week number, and `1` for weeks that start on
   * another day.
   */
  firstWeekContainsDate?: DayOfWeek | undefined;
  /**
   * The grid shows the broadcast calendar: weeks from Monday, and a month of the 4 or 5 weeks from
   * the Monday of the week that holds its first day. It needs the Gregorian calendar.
   * @default false
   */
  broadcastCalendar?: boolean | undefined;
  /**
   * One page of whole weeks, `{ weeks: 2 }`, or one row of days, `{ days: 5 }`, in place of a
   * month. The navigation buttons move by this duration.
   */
  visibleDuration?: CalendarVisibleDuration | undefined;
  /** The first day that the user can select. An earlier day is disabled. */
  min?: DateValue | undefined;
  /** The last day that the user can select. A later day is disabled. It wins over `min`. */
  max?: DateValue | undefined;
  /** The days that take no focus and no selection. */
  disabledDates?: CalendarDateMatcher | undefined;
  /** The days that take the focus and no selection. */
  unavailableDates?: CalendarDateMatcher | undefined;
  /** The days that have no button. */
  hiddenDates?: CalendarDateMatcher | undefined;
  /**
   * A day that a rule matches has a `data-*` attribute in kebab case with the name of the rule, and
   * `state.modifiers[name]` is `true`. The names of the day attributes are reserved.
   */
  modifiers?: Record<string, CalendarDateMatcher> | undefined;
  /**
   * The day that is today. With none, the root reads the clock after the mount, in the zone of a
   * zoned value. The server HTML then has no today. A server that knows the day of the visitor
   * gives it here.
   */
  today?: DateValue | undefined;
  /** The locale of each text. With none, the nearest `LocaleProvider`, else `en-US`. */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar of the grid, such as `gregory` or `persian`. The default is the calendar of a
   * value that is not ISO, else `gregory`. The value keeps its own calendar. A year and month shows
   * in this calendar only when the two calendars have the same months, as `buddhist` and `gregory` do.
   */
  calendar?: string | undefined;
  /**
   * The user cannot change the calendar, and no part of it takes the focus.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The user cannot select a day. The days take the focus, and the buttons move the page.
   * @default false
   */
  readonly?: boolean | undefined;
  /**
   * The value of the calendar is not valid.
   * @default false
   */
  invalid?: boolean | undefined;
  /**
   * The day that has the tab stop takes the focus at the mount.
   * @default false
   */
  autofocus?: boolean | undefined;
}

export interface CalendarRootProps<
  Value extends CalendarValue = Temporal.PlainDate,
  Multiple extends boolean | undefined = false,
> extends CalendarBaseProps {
  /**
   * The selected value, or the list of selected values with `multiple`. `v-model` binds it. A
   * `Temporal.PlainYearMonth` selects a month in the grid of months. A new value has the kind, the
   * calendar, the time and the zone of the first value, else of `defaultValue`, else of the last
   * value. With none of them, it is a `Temporal.PlainDate`.
   */
  modelValue?: (Multiple extends true ? readonly Value[] : Value | null) | undefined;
  /** The value at the mount of an uncontrolled calendar. It also gives the kind of a new value. */
  defaultValue?: (Multiple extends true ? readonly Value[] : Value | null) | undefined;
  /**
   * The user selects a list of days or months. A press on a selected day removes it. Without it, a
   * press on the selected day keeps it.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /**
   * The least number of values with `multiple`. A press removes a value only above it.
   * @default 0
   */
  minDays?: number | undefined;
  /** The greatest number of values with `multiple`. A press adds a value only below it. */
  maxDays?: number | undefined;
  /** What the grid shows. `v-model:view` binds it. */
  view?: CalendarRootView | undefined;
  /**
   * The view at the mount of an uncontrolled view. The default is `day`, and `month` for a value
   * that is a year and month.
   */
  defaultView?: CalendarRootView | undefined;
  /**
   * The number of years on a page of years. A page starts with a multiple of this number.
   * @default 12
   */
  visibleYears?: number | undefined;
  /** The months that take no focus and no selection, in the calendar of the grid. */
  disabledMonths?: ((month: Temporal.PlainYearMonth) => boolean) | undefined;
  /** The years that take no focus, as the first month of each year, in the calendar of the grid. */
  disabledYears?: ((year: Temporal.PlainYearMonth) => boolean) | undefined;
}

/** `as` and the attributes of the element of a part. */
interface DivProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

/** WAI-ARIA 1.3 gives each element `aria-description`, and the types of Vue do not list it. */
interface AriaDescription {
  'aria-description'?: string | undefined;
}

/** The props of a button of the calendar. */
interface ButtonProps
  extends
    AsProps,
    /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'>,
    /* @vue-ignore */ AriaDescription {}

export interface CalendarMonthsProps extends DivProps {}
export interface CalendarMonthsState extends CalendarState {
  navigationDirection: CalendarRootState['navigationDirection'];
}

export interface CalendarMonthProps extends DivProps {
  /** The page that the part shows. It is the value of the slot `month` of `Calendar.Months`. */
  month: CalendarPage;
}
export interface CalendarMonthState extends CalendarState {
  /** The place of the month in the page, from 0. */
  index: number;
}

export interface CalendarCaptionProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The grid of the month names itself by this id in `aria-labelledby`. */
  id?: string | undefined;
  /** The format of the text. The default is the month and the year in full. */
  format?: Intl.DateTimeFormatOptions | undefined;
}
export type CalendarCaptionState = CalendarState;

export interface CalendarGridProps
  extends AsProps, /* @vue-ignore */ Omit<TableHTMLAttributes, 'as'> {}
export type CalendarGridState = CalendarState;

export interface CalendarGridHeaderProps extends DivProps {}
export type CalendarGridHeaderState = CalendarState;

export interface CalendarGridHeaderRowProps extends DivProps {}
export type CalendarGridHeaderRowState = CalendarState;

export interface CalendarWeekdayProps
  extends AsProps, /* @vue-ignore */ Omit<ThHTMLAttributes, 'as' | 'abbr' | 'scope'> {
  /** The day of the week. It is the value of the slot `weekday` of `Calendar.GridHeaderRow`. */
  weekday: DayOfWeek;
  /**
   * The length of the name.
   * @default 'short'
   */
  format?: NonNullable<Intl.DateTimeFormatOptions['weekday']> | undefined;
}
export type CalendarWeekdayState = CalendarState;

export interface CalendarWeekNumberHeaderProps
  extends AsProps, /* @vue-ignore */ Omit<ThHTMLAttributes, 'as' | 'scope'> {}
export type CalendarWeekNumberHeaderState = CalendarState;

export interface CalendarGridBodyProps extends DivProps {}
export type CalendarGridBodyState = CalendarState;

export interface CalendarWeekProps extends DivProps {
  /** The week that the part shows. It is the value of the slot `week` of `Calendar.GridBody`. */
  week: CalendarWeek;
}
export type CalendarWeekState = CalendarState;

export interface CalendarWeekNumberProps
  extends AsProps, /* @vue-ignore */ Omit<ThHTMLAttributes, 'as' | 'scope'> {
  /** The week of the row. */
  week: CalendarWeek;
}
export interface CalendarWeekNumberState extends CalendarState {
  weekNumber: number;
}

export interface CalendarDayProps extends AsProps, /* @vue-ignore */ Omit<TdHTMLAttributes, 'as'> {
  /** The day that the part shows. It is the value of the slot `day` of `Calendar.Week`. */
  day: Temporal.PlainDate;
}
export interface CalendarDayState {
  /** The day is in the selection. */
  selected: boolean;
  /** The day takes no focus and no selection: a disabled calendar, `min`, `max` or `disabledDates`. */
  disabled: boolean;
  /** The day takes the focus and no selection: `unavailableDates`. */
  unavailable: boolean;
  /** The day has no button: `hiddenDates`, another page owns it, or an outside day. */
  hidden: boolean;
  today: boolean;
  /** The day is in the month before or after the month of its page. */
  outsideMonth: boolean;
  /** The first day of a range. */
  rangeStart: boolean;
  /** The last day of a range. */
  rangeEnd: boolean;
  /** A day between the two ends of a range. */
  rangeMiddle: boolean;
  /** `true` for each rule of `modifiers` that matches the day. */
  modifiers: Record<string, boolean>;
}

export interface CalendarDayButtonProps extends ButtonProps {
  /** The format of the name of the button. The default is the weekday, the day, the month and the year. */
  format?: Intl.DateTimeFormatOptions | undefined;
}
export type CalendarDayButtonState = CalendarDayState;

export interface CalendarPreviousButtonProps extends ButtonProps {
  /**
   * The user cannot press the button. A disabled calendar also disables it.
   * @default false
   */
  disabled?: boolean | undefined;
}
export type CalendarPreviousButtonState = CalendarState;

export interface CalendarNextButtonProps extends CalendarPreviousButtonProps {}
export type CalendarNextButtonState = CalendarState;

export interface CalendarMonthSelectProps extends /* @vue-ignore */ Omit<
  SelectHTMLAttributes,
  'disabled' | 'value'
> {
  /**
   * The length of the name of a month.
   * @default 'long'
   */
  format?: NonNullable<Intl.DateTimeFormatOptions['month']> | undefined;
}
export type CalendarMonthSelectState = CalendarState;

export interface CalendarYearSelectProps extends /* @vue-ignore */ Omit<
  SelectHTMLAttributes,
  'disabled' | 'value'
> {
  /**
   * The form of a year.
   * @default 'numeric'
   */
  format?: NonNullable<Intl.DateTimeFormatOptions['year']> | undefined;
  /**
   * The order of the years.
   * @default 'asc'
   */
  order?: 'asc' | 'desc' | undefined;
}
export type CalendarYearSelectState = CalendarState;

/** An option of `Calendar.MonthSelect` or `Calendar.YearSelect`. */
export interface CalendarSelectOption {
  value: string;
  text: string;
  disabled: boolean;
}

export interface CalendarViewTriggerProps extends ButtonProps {
  /**
   * The view that a press shows. A second press shows the days again.
   * @default 'year'
   */
  view?: 'month' | 'year' | undefined;
  /**
   * The user cannot press the trigger. A disabled calendar also disables it.
   * @default false
   */
  disabled?: boolean | undefined;
}
export interface CalendarViewTriggerState extends CalendarState {
  /** The view of the `view` prop. */
  view: 'month' | 'year';
  /** The grid shows the view of the trigger. */
  active: boolean;
}

export interface CalendarMonthGridProps extends DivProps {
  /**
   * The cells of a row.
   * @default 3
   */
  columns?: number | undefined;
}
export type CalendarMonthGridState = CalendarState;

export interface CalendarMonthGridRowProps extends DivProps {}
export type CalendarMonthGridRowState = CalendarState;

/** The state of a month cell or a year cell. */
export interface CalendarCellState {
  /** A selected value is in the month or in the year. */
  selected: boolean;
  /** The cell takes no focus and no press: a disabled calendar, the limits, or its rule. */
  disabled: boolean;
  /** Today is in the month or in the year. */
  current: boolean;
}

export interface CalendarMonthCellProps extends ButtonProps {
  /** The month of the cell. It is an item of the slot `row` of `Calendar.MonthGrid`. */
  month: Temporal.PlainYearMonth;
  /**
   * The length of the name of the month.
   * @default 'long'
   */
  format?: NonNullable<Intl.DateTimeFormatOptions['month']> | undefined;
}
export type CalendarMonthCellState = CalendarCellState;

export interface CalendarYearGridProps extends CalendarMonthGridProps {}
export type CalendarYearGridState = CalendarState;

export interface CalendarYearGridRowProps extends DivProps {}
export type CalendarYearGridRowState = CalendarState;

export interface CalendarYearCellProps extends ButtonProps {
  /** The first month of the year of the cell. It is an item of the slot `row` of `Calendar.YearGrid`. */
  year: Temporal.PlainYearMonth;
  /**
   * The form of the year.
   * @default 'numeric'
   */
  format?: NonNullable<Intl.DateTimeFormatOptions['year']> | undefined;
}
export type CalendarYearCellState = CalendarCellState;

export interface CalendarFooterProps extends DivProps {}
export type CalendarFooterState = CalendarState;
