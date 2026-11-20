import CalendarCaption from './CalendarCaption.vue';
import CalendarDay from './CalendarDay.vue';
import CalendarDayButton from './CalendarDayButton.vue';
import CalendarFooter from './CalendarFooter.vue';
import CalendarGrid from './CalendarGrid.vue';
import CalendarGridBody from './CalendarGridBody.vue';
import CalendarGridHeader from './CalendarGridHeader.vue';
import CalendarGridHeaderRow from './CalendarGridHeaderRow.vue';
import CalendarMonth from './CalendarMonth.vue';
import CalendarMonthCell from './CalendarMonthCell.vue';
import CalendarMonthGrid from './CalendarMonthGrid.vue';
import CalendarMonthGridRow from './CalendarMonthGridRow.vue';
import CalendarMonthSelect from './CalendarMonthSelect.vue';
import CalendarMonths from './CalendarMonths.vue';
import CalendarNextButton from './CalendarNextButton.vue';
import CalendarPreviousButton from './CalendarPreviousButton.vue';
import CalendarRoot from './CalendarRoot.vue';
import CalendarViewTrigger from './CalendarViewTrigger.vue';
import CalendarWeek from './CalendarWeek.vue';
import CalendarWeekNumber from './CalendarWeekNumber.vue';
import CalendarWeekNumberHeader from './CalendarWeekNumberHeader.vue';
import CalendarWeekday from './CalendarWeekday.vue';
import CalendarYearCell from './CalendarYearCell.vue';
import CalendarYearGrid from './CalendarYearGrid.vue';
import CalendarYearGridRow from './CalendarYearGridRow.vue';
import CalendarYearSelect from './CalendarYearSelect.vue';
import type {
  CalendarCaptionProps,
  CalendarCaptionState,
  CalendarDayButtonProps,
  CalendarDayButtonState,
  CalendarDayProps,
  CalendarDayState,
  CalendarFooterProps,
  CalendarFooterState,
  CalendarGridBodyProps,
  CalendarGridBodyState,
  CalendarGridHeaderProps,
  CalendarGridHeaderRowProps,
  CalendarGridHeaderRowState,
  CalendarGridHeaderState,
  CalendarGridProps,
  CalendarGridState,
  CalendarMonthCellProps,
  CalendarMonthCellState,
  CalendarMonthGridProps,
  CalendarMonthGridRowProps,
  CalendarMonthGridRowState,
  CalendarMonthGridState,
  CalendarMonthProps,
  CalendarMonthSelectProps,
  CalendarMonthSelectState,
  CalendarMonthState,
  CalendarMonthsProps,
  CalendarMonthsState,
  CalendarNextButtonProps,
  CalendarNextButtonState,
  CalendarPreviousButtonProps,
  CalendarPreviousButtonState,
  CalendarRootChangeEventDetails,
  CalendarRootChangeEventReason,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
  CalendarValue,
  CalendarViewTriggerProps,
  CalendarViewTriggerState,
  CalendarWeekNumberHeaderProps,
  CalendarWeekNumberHeaderState,
  CalendarWeekNumberProps,
  CalendarWeekNumberState,
  CalendarWeekProps,
  CalendarWeekState,
  CalendarWeekdayProps,
  CalendarWeekdayState,
  CalendarYearCellProps,
  CalendarYearCellState,
  CalendarYearGridProps,
  CalendarYearGridRowProps,
  CalendarYearGridRowState,
  CalendarYearGridState,
  CalendarYearSelectProps,
  CalendarYearSelectState,
} from './types';

/**
 * Groups all parts of the calendar.
 * Renders a `<div>` element.
 * @selector `[data-view]` What the grid shows: `day`, `month` or `year`.
 * @selector `[data-navigation-direction]` The side of the last move of the page: `previous`, `next` or `none`.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Root: typeof CalendarRoot = CalendarRoot;
export namespace Root {
  export type Props<
    Value extends CalendarValue = Temporal.PlainDate,
    Multiple extends boolean | undefined = false,
  > = CalendarRootProps<Value, Multiple>;
  export type State = CalendarRootState;
  export type ChangeEventReason = CalendarRootChangeEventReason;
  export type ChangeEventDetails = CalendarRootChangeEventDetails;
  export type View = CalendarRootView;
}

/**
 * A button that shows the page before. A hold of the button repeats the move.
 * Renders a `<button>` element.
 * @selector `:disabled` The button or the calendar is disabled, and the button is a native button.
 * @selector `[aria-disabled="true"]` The page is at `min`, or the button is another element and is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const PreviousButton: typeof CalendarPreviousButton = CalendarPreviousButton;
export namespace PreviousButton {
  export type Props = CalendarPreviousButtonProps;
  export type State = CalendarPreviousButtonState;
}

/**
 * A button that shows the page after. A hold of the button repeats the move.
 * Renders a `<button>` element.
 * @selector `:disabled` The button or the calendar is disabled, and the button is a native button.
 * @selector `[aria-disabled="true"]` The page is at `max`, or the button is another element and is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const NextButton: typeof CalendarNextButton = CalendarNextButton;
export namespace NextButton {
  export type Props = CalendarNextButtonProps;
  export type State = CalendarNextButtonState;
}

/**
 * A button that shows the grid of months or of years, and the days again.
 * Renders a `<button>` element.
 * @selector `[data-active]` The grid shows the view of the trigger.
 * @selector `:disabled` The trigger is a native button, and it is disabled: by its prop, by the calendar, or because the calendar shows days only.
 * @selector `[aria-disabled="true"]` The trigger is another element, and it is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const ViewTrigger: typeof CalendarViewTrigger = CalendarViewTrigger;
export namespace ViewTrigger {
  export type Props = CalendarViewTriggerProps;
  export type State = CalendarViewTriggerState;
}

/**
 * Renders the months of the page, one for each item of its slot `month`.
 * Renders a `<div>` element, only in the view of days.
 * @selector `[data-navigation-direction]` The side of the last move of the page: `previous`, `next` or `none`.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Months: typeof CalendarMonths = CalendarMonths;
export namespace Months {
  export type Props = CalendarMonthsProps;
  export type State = CalendarMonthsState;
}

/**
 * Groups the parts of one month of the page.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Month: typeof CalendarMonth = CalendarMonth;
export namespace Month {
  export type Props = CalendarMonthProps;
  export type State = CalendarMonthState;
}

/**
 * The name of the month. It names the grid of the month.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Caption: typeof CalendarCaption = CalendarCaption;
export namespace Caption {
  export type Props = CalendarCaptionProps;
  export type State = CalendarCaptionState;
}

/**
 * A select of the month of the page.
 * Renders a `<select>` element.
 * @selector `:disabled` The calendar is disabled, or the calendar shows no month.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const MonthSelect: typeof CalendarMonthSelect = CalendarMonthSelect;
export namespace MonthSelect {
  export type Props = CalendarMonthSelectProps;
  export type State = CalendarMonthSelectState;
}

/**
 * A select of the year of the page.
 * Renders a `<select>` element.
 * @selector `:disabled` The calendar is disabled, or the calendar shows no month.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const YearSelect: typeof CalendarYearSelect = CalendarYearSelect;
export namespace YearSelect {
  export type Props = CalendarYearSelectProps;
  export type State = CalendarYearSelectState;
}

/**
 * The grid of the days of a month.
 * Renders a `<table>` element.
 * @selector `[aria-disabled="true"]` The calendar is disabled.
 * @selector `[aria-readonly="true"]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Grid: typeof CalendarGrid = CalendarGrid;
export namespace Grid {
  export type Props = CalendarGridProps;
  export type State = CalendarGridState;
}

/**
 * The head of the grid.
 * Renders a `<thead>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const GridHeader: typeof CalendarGridHeader = CalendarGridHeader;
export namespace GridHeader {
  export type Props = CalendarGridHeaderProps;
  export type State = CalendarGridHeaderState;
}

/**
 * The row of the names of the days.
 * Renders a `<tr>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const GridHeaderRow: typeof CalendarGridHeaderRow = CalendarGridHeaderRow;
export namespace GridHeaderRow {
  export type Props = CalendarGridHeaderRowProps;
  export type State = CalendarGridHeaderRowState;
}

/**
 * The name of a day of the week.
 * Renders a `<th>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Weekday: typeof CalendarWeekday = CalendarWeekday;
export namespace Weekday {
  export type Props = CalendarWeekdayProps;
  export type State = CalendarWeekdayState;
}

/**
 * The head of the column of week numbers.
 * Renders a `<th>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const WeekNumberHeader: typeof CalendarWeekNumberHeader = CalendarWeekNumberHeader;
export namespace WeekNumberHeader {
  export type Props = CalendarWeekNumberHeaderProps;
  export type State = CalendarWeekNumberHeaderState;
}

/**
 * The weeks of the grid.
 * Renders a `<tbody>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const GridBody: typeof CalendarGridBody = CalendarGridBody;
export namespace GridBody {
  export type Props = CalendarGridBodyProps;
  export type State = CalendarGridBodyState;
}

/**
 * A row of days.
 * Renders a `<tr>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Week: typeof CalendarWeek = CalendarWeek;
export namespace Week {
  export type Props = CalendarWeekProps;
  export type State = CalendarWeekState;
}

/**
 * The number of a week.
 * Renders a `<th>` element.
 * @selector `[data-week-number]` The number of the week, such as `[data-week-number="1"]`.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const WeekNumber: typeof CalendarWeekNumber = CalendarWeekNumber;
export namespace WeekNumber {
  export type Props = CalendarWeekNumberProps;
  export type State = CalendarWeekNumberState;
}

/**
 * A cell of the grid for one day.
 * Renders a `<td>` element.
 * @selector `[aria-selected="true"]` The day is selected.
 * @selector `[data-disabled]` The day takes no focus and no selection: the calendar is disabled, or `min`, `max` or `disabledDates` disables the day.
 * @selector `[data-unavailable]` `unavailableDates` matches the day.
 * @selector `[data-hidden]` The day has no button.
 * @selector `[data-today]` The day is today.
 * @selector `[data-outside-month]` The day is in the month before or after the month of its page.
 * @selector `[data-range-start]` The day is the first day of the range of `RangeCalendar.Root`.
 * @selector `[data-range-end]` The day is the last day of the range of `RangeCalendar.Root`.
 * @selector `[data-range-middle]` The day is between the two ends of the range of `RangeCalendar.Root`.
 * @selector `[data-<modifier>]` A rule of `modifiers` matches the day, such as `[data-holiday]` for the rule `holiday`.
 */
export const Day: typeof CalendarDay = CalendarDay;
export namespace Day {
  export type Props = CalendarDayProps;
  export type State = CalendarDayState;
}

/**
 * The button of a day, which selects it.
 * Renders a `<button>` element, and no element for a hidden day.
 * @selector `[data-selected]` The day is selected.
 * @selector `[aria-current="date"]` The day is today.
 * @selector `:disabled` The button is a native button, and the day is disabled.
 * @selector `[aria-disabled="true"]` The day is unavailable, or the button is another element and the day is disabled.
 * @selector `[data-unavailable]` `unavailableDates` matches the day.
 * @selector `[data-outside-month]` The day is in the month before or after the month of its page.
 * @selector `[data-range-start]` The day is the first day of the range of `RangeCalendar.Root`.
 * @selector `[data-range-end]` The day is the last day of the range of `RangeCalendar.Root`.
 * @selector `[data-range-middle]` The day is between the two ends of the range of `RangeCalendar.Root`.
 * @selector `[data-<modifier>]` A rule of `modifiers` matches the day, such as `[data-holiday]` for the rule `holiday`.
 */
export const DayButton: typeof CalendarDayButton = CalendarDayButton;
export namespace DayButton {
  export type Props = CalendarDayButtonProps;
  export type State = CalendarDayButtonState;
}

/**
 * The grid of the months of a year.
 * Renders a `<div>` element, only in the view of months.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const MonthGrid: typeof CalendarMonthGrid = CalendarMonthGrid;
export namespace MonthGrid {
  export type Props = CalendarMonthGridProps;
  export type State = CalendarMonthGridState;
}

/**
 * A row of month cells.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const MonthGridRow: typeof CalendarMonthGridRow = CalendarMonthGridRow;
export namespace MonthGridRow {
  export type Props = CalendarMonthGridRowProps;
  export type State = CalendarMonthGridRowState;
}

/**
 * A month of the grid of months.
 * Renders a `<button>` element.
 * @selector `[aria-selected="true"]` A selected value is in the month.
 * @selector `[aria-current="date"]` Today is in the month.
 * @selector `:disabled` The cell is a native button, and the calendar, `min`, `max` or `disabledMonths` disables the month.
 * @selector `[aria-disabled="true"]` The cell is another element, and the month is disabled.
 */
export const MonthCell: typeof CalendarMonthCell = CalendarMonthCell;
export namespace MonthCell {
  export type Props = CalendarMonthCellProps;
  export type State = CalendarMonthCellState;
}

/**
 * The grid of a page of years.
 * Renders a `<div>` element, only in the view of years.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const YearGrid: typeof CalendarYearGrid = CalendarYearGrid;
export namespace YearGrid {
  export type Props = CalendarYearGridProps;
  export type State = CalendarYearGridState;
}

/**
 * A row of year cells.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const YearGridRow: typeof CalendarYearGridRow = CalendarYearGridRow;
export namespace YearGridRow {
  export type Props = CalendarYearGridRowProps;
  export type State = CalendarYearGridRowState;
}

/**
 * A year of the grid of years.
 * Renders a `<button>` element.
 * @selector `[aria-selected="true"]` A selected value is in the year.
 * @selector `[aria-current="date"]` Today is in the year.
 * @selector `:disabled` The cell is a native button, and the calendar, `min`, `max` or `disabledYears` disables the year.
 * @selector `[aria-disabled="true"]` The cell is another element, and the year is disabled.
 */
export const YearCell: typeof CalendarYearCell = CalendarYearCell;
export namespace YearCell {
  export type Props = CalendarYearCellProps;
  export type State = CalendarYearCellState;
}

/**
 * A live region for text about the calendar.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day and no month is selected.
 */
export const Footer: typeof CalendarFooter = CalendarFooter;
export namespace Footer {
  export type Props = CalendarFooterProps;
  export type State = CalendarFooterState;
}
