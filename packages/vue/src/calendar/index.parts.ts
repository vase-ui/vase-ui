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
} from './root/CalendarRoot.vue';
import CalendarWeek from './week/CalendarWeek.vue';
import type { CalendarWeekProps, CalendarWeekState } from './week/CalendarWeek.vue';
import CalendarWeekday from './weekday/CalendarWeekday.vue';
import type { CalendarWeekdayProps, CalendarWeekdayState } from './weekday/CalendarWeekday.vue';
import type { DateValue } from '../internals/date-time/temporal';

/**
 * Groups all parts of the calendar and holds the selected day, the month that the grid shows and
 * the day that has the tab stop.
 * Renders a `<div>` element.
 */
export const Root: typeof CalendarRoot = CalendarRoot;
export namespace Root {
  export type Props<
    Value extends DateValue = Temporal.PlainDate,
    Multiple extends boolean | undefined = false,
  > = CalendarRootProps<Value, Multiple>;
  export type State = CalendarRootState;
  export type ChangeEventReason = CalendarRootChangeEventReason;
  export type ChangeEventDetails = CalendarRootChangeEventDetails;
}

/**
 * Renders a month for each page of the calendar.
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
