import CalendarDayButton from './day-button/CalendarDayButton.vue';
import type {
  CalendarDayButtonProps,
  CalendarDayButtonState,
} from './day-button/CalendarDayButton.vue';
import CalendarDay from './day/CalendarDay.vue';
import type { CalendarDayProps, CalendarDayState } from './day/CalendarDay.vue';
import CalendarGridBody from './grid-body/CalendarGridBody.vue';
import type {
  CalendarGridBodyProps,
  CalendarGridBodyState,
} from './grid-body/CalendarGridBody.vue';
import CalendarGridHeaderRow from './grid-header-row/CalendarGridHeaderRow.vue';
import type {
  CalendarGridHeaderRowProps,
  CalendarGridHeaderRowState,
} from './grid-header-row/CalendarGridHeaderRow.vue';
import CalendarGridHeader from './grid-header/CalendarGridHeader.vue';
import type {
  CalendarGridHeaderProps,
  CalendarGridHeaderState,
} from './grid-header/CalendarGridHeader.vue';
import CalendarGrid from './grid/CalendarGrid.vue';
import type { CalendarGridProps, CalendarGridState } from './grid/CalendarGrid.vue';
import CalendarMonth from './month/CalendarMonth.vue';
import type { CalendarMonthProps, CalendarMonthState } from './month/CalendarMonth.vue';
import CalendarMonths from './months/CalendarMonths.vue';
import type { CalendarMonthsProps, CalendarMonthsState } from './months/CalendarMonths.vue';
import CalendarRoot from './root/CalendarRoot.vue';
import type {
  CalendarRootChangeEventDetails,
  CalendarRootChangeEventReason,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
} from './root/CalendarRoot.vue';
import CalendarWeek from './week/CalendarWeek.vue';
import type { CalendarWeekProps, CalendarWeekState } from './week/CalendarWeek.vue';
import CalendarWeekday from './weekday/CalendarWeekday.vue';
import type { CalendarWeekdayProps, CalendarWeekdayState } from './weekday/CalendarWeekday.vue';
import CalendarCaption from './caption/CalendarCaption.vue';
import type { CalendarCaptionProps, CalendarCaptionState } from './caption/CalendarCaption.vue';
import CalendarMonthSelect from './month-select/CalendarMonthSelect.vue';
import type {
  CalendarMonthSelectProps,
  CalendarMonthSelectState,
} from './month-select/CalendarMonthSelect.vue';
import CalendarYearSelect from './year-select/CalendarYearSelect.vue';
import type {
  CalendarYearSelectProps,
  CalendarYearSelectState,
} from './year-select/CalendarYearSelect.vue';
import CalendarPreviousButton from './previous-button/CalendarPreviousButton.vue';
import type {
  CalendarPreviousButtonProps,
  CalendarPreviousButtonState,
} from './previous-button/CalendarPreviousButton.vue';
import CalendarNextButton from './next-button/CalendarNextButton.vue';
import type {
  CalendarNextButtonProps,
  CalendarNextButtonState,
} from './next-button/CalendarNextButton.vue';
import CalendarWeekNumberHeader from './week-number-header/CalendarWeekNumberHeader.vue';
import type {
  CalendarWeekNumberHeaderProps,
  CalendarWeekNumberHeaderState,
} from './week-number-header/CalendarWeekNumberHeader.vue';
import CalendarWeekNumber from './week-number/CalendarWeekNumber.vue';
import type {
  CalendarWeekNumberProps,
  CalendarWeekNumberState,
} from './week-number/CalendarWeekNumber.vue';
import CalendarFooter from './footer/CalendarFooter.vue';
import type { CalendarFooterProps, CalendarFooterState } from './footer/CalendarFooter.vue';
import CalendarViewTrigger from './view-trigger/CalendarViewTrigger.vue';
import type {
  CalendarViewTriggerProps,
  CalendarViewTriggerState,
} from './view-trigger/CalendarViewTrigger.vue';
import CalendarMonthGrid from './month-grid/CalendarMonthGrid.vue';
import type {
  CalendarMonthGridProps,
  CalendarMonthGridState,
} from './month-grid/CalendarMonthGrid.vue';
import CalendarMonthGridRow from './month-grid-row/CalendarMonthGridRow.vue';
import type {
  CalendarMonthGridRowProps,
  CalendarMonthGridRowState,
} from './month-grid-row/CalendarMonthGridRow.vue';
import CalendarMonthCell from './month-cell/CalendarMonthCell.vue';
import type {
  CalendarMonthCellProps,
  CalendarMonthCellState,
} from './month-cell/CalendarMonthCell.vue';
import CalendarYearGrid from './year-grid/CalendarYearGrid.vue';
import type {
  CalendarYearGridProps,
  CalendarYearGridState,
} from './year-grid/CalendarYearGrid.vue';
import CalendarYearGridRow from './year-grid-row/CalendarYearGridRow.vue';
import type {
  CalendarYearGridRowProps,
  CalendarYearGridRowState,
} from './year-grid-row/CalendarYearGridRow.vue';
import CalendarYearCell from './year-cell/CalendarYearCell.vue';
import type {
  CalendarYearCellProps,
  CalendarYearCellState,
} from './year-cell/CalendarYearCell.vue';
import type { CalendarValue } from '../internals/date-time/calendar/useCalendarRoot';

/**
 * Groups all parts of the calendar and holds the selected day or month, the month that the grid
 * shows, the view and the day that has the tab stop.
 * Renders a `<div>` element.
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
 * Renders a month for each page of the calendar. It shows only in the view `day`.
 * Renders a `<div>` element.
 */
export const Months: typeof CalendarMonths = CalendarMonths;
export namespace Months {
  export type Props = CalendarMonthsProps;
  export type State = CalendarMonthsState;
}

/**
 * Groups the parts of one month.
 * Renders a `<div>` element.
 */
export const Month: typeof CalendarMonth = CalendarMonth;
export namespace Month {
  export type Props = CalendarMonthProps;
  export type State = CalendarMonthState;
}

/**
 * The grid of the days of a month.
 * Renders a `<table>` element.
 */
export const Grid: typeof CalendarGrid = CalendarGrid;
export namespace Grid {
  export type Props = CalendarGridProps;
  export type State = CalendarGridState;
}

/**
 * Groups the names of the days of the week.
 * Renders a `<thead>` element.
 */
export const GridHeader: typeof CalendarGridHeader = CalendarGridHeader;
export namespace GridHeader {
  export type Props = CalendarGridHeaderProps;
  export type State = CalendarGridHeaderState;
}

/**
 * The row of the names of the days of the week.
 * Renders a `<tr>` element.
 */
export const GridHeaderRow: typeof CalendarGridHeaderRow = CalendarGridHeaderRow;
export namespace GridHeaderRow {
  export type Props = CalendarGridHeaderRowProps;
  export type State = CalendarGridHeaderRowState;
}

/**
 * The name of a day of the week.
 * Renders a `<th>` element.
 */
export const Weekday: typeof CalendarWeekday = CalendarWeekday;
export namespace Weekday {
  export type Props = CalendarWeekdayProps;
  export type State = CalendarWeekdayState;
}

/**
 * Groups the weeks of a month.
 * Renders a `<tbody>` element.
 */
export const GridBody: typeof CalendarGridBody = CalendarGridBody;
export namespace GridBody {
  export type Props = CalendarGridBodyProps;
  export type State = CalendarGridBodyState;
}

/**
 * The row of the days of a week.
 * Renders a `<tr>` element.
 */
export const Week: typeof CalendarWeek = CalendarWeek;
export namespace Week {
  export type Props = CalendarWeekProps;
  export type State = CalendarWeekState;
}

/**
 * The cell of a day. It holds the state of the day and the day button.
 * Renders a `<td>` element.
 */
export const Day: typeof CalendarDay = CalendarDay;
export namespace Day {
  export type Props = CalendarDayProps;
  export type State = CalendarDayState;
}

/**
 * The button that selects a day, and that has the tab stop when its day has it.
 * Renders a `<button>` element.
 */
export const DayButton: typeof CalendarDayButton = CalendarDayButton;
export namespace DayButton {
  export type Props = CalendarDayButtonProps;
  export type State = CalendarDayButtonState;
}

/**
 * The name of the month, as a live region. The grid of the month is named by it.
 * Renders a `<div>` element.
 */
export const Caption: typeof CalendarCaption = CalendarCaption;
export namespace Caption {
  export type Props = CalendarCaptionProps;
  export type State = CalendarCaptionState;
}

/**
 * A select that sets the month of the page.
 * Renders a `<select>` element.
 */
export const MonthSelect: typeof CalendarMonthSelect = CalendarMonthSelect;
export namespace MonthSelect {
  export type Props = CalendarMonthSelectProps;
  export type State = CalendarMonthSelectState;
}

/**
 * A select that sets the year of the page.
 * Renders a `<select>` element.
 */
export const YearSelect: typeof CalendarYearSelect = CalendarYearSelect;
export namespace YearSelect {
  export type Props = CalendarYearSelectProps;
  export type State = CalendarYearSelectState;
}

/**
 * The button that shows the page before. A hold repeats the move.
 * Renders a `<button>` element.
 */
export const PreviousButton: typeof CalendarPreviousButton = CalendarPreviousButton;
export namespace PreviousButton {
  export type Props = CalendarPreviousButtonProps;
  export type State = CalendarPreviousButtonState;
}

/**
 * The button that shows the page after. A hold repeats the move.
 * Renders a `<button>` element.
 */
export const NextButton: typeof CalendarNextButton = CalendarNextButton;
export namespace NextButton {
  export type Props = CalendarNextButtonProps;
  export type State = CalendarNextButtonState;
}

/**
 * The header of the column of the week numbers.
 * Renders a `<th>` element.
 */
export const WeekNumberHeader: typeof CalendarWeekNumberHeader = CalendarWeekNumberHeader;
export namespace WeekNumberHeader {
  export type Props = CalendarWeekNumberHeaderProps;
  export type State = CalendarWeekNumberHeaderState;
}

/**
 * The number of a week.
 * Renders a `<th>` element.
 */
export const WeekNumber: typeof CalendarWeekNumber = CalendarWeekNumber;
export namespace WeekNumber {
  export type Props = CalendarWeekNumberProps;
  export type State = CalendarWeekNumberState;
}

/**
 * A live region for a message below the calendar.
 * Renders a `<div>` element.
 */
export const Footer: typeof CalendarFooter = CalendarFooter;
export namespace Footer {
  export type Props = CalendarFooterProps;
  export type State = CalendarFooterState;
}

/**
 * The button that shows the grid of months or the grid of years, and shows the first view again
 * when a press comes while that grid shows. Its text is the name of what the grid shows.
 * Renders a `<button>` element.
 */
export const ViewTrigger: typeof CalendarViewTrigger = CalendarViewTrigger;
export namespace ViewTrigger {
  export type Props = CalendarViewTriggerProps;
  export type State = CalendarViewTriggerState;
}

/**
 * The grid of the months of a year. It shows only in the view `month`.
 * Renders a `<div>` element.
 */
export const MonthGrid: typeof CalendarMonthGrid = CalendarMonthGrid;
export namespace MonthGrid {
  export type Props = CalendarMonthGridProps;
  export type State = CalendarMonthGridState;
}

/**
 * The row of the months of a grid.
 * Renders a `<div>` element.
 */
export const MonthGridRow: typeof CalendarMonthGridRow = CalendarMonthGridRow;
export namespace MonthGridRow {
  export type Props = CalendarMonthGridRowProps;
  export type State = CalendarMonthGridRowState;
}

/**
 * The button of a month. A press selects the month of a year and month, and else shows its days.
 * Renders a `<button>` element.
 */
export const MonthCell: typeof CalendarMonthCell = CalendarMonthCell;
export namespace MonthCell {
  export type Props = CalendarMonthCellProps;
  export type State = CalendarMonthCellState;
}

/**
 * The grid of a page of years. It shows only in the view `year`.
 * Renders a `<div>` element.
 */
export const YearGrid: typeof CalendarYearGrid = CalendarYearGrid;
export namespace YearGrid {
  export type Props = CalendarYearGridProps;
  export type State = CalendarYearGridState;
}

/**
 * The row of the years of a grid.
 * Renders a `<div>` element.
 */
export const YearGridRow: typeof CalendarYearGridRow = CalendarYearGridRow;
export namespace YearGridRow {
  export type Props = CalendarYearGridRowProps;
  export type State = CalendarYearGridRowState;
}

/**
 * The button of a year. A press shows the months of that year.
 * Renders a `<button>` element.
 */
export const YearCell: typeof CalendarYearCell = CalendarYearCell;
export namespace YearCell {
  export type Props = CalendarYearCellProps;
  export type State = CalendarYearCellState;
}
