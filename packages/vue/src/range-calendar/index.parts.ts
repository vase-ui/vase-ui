import RangeCalendarDayButton from './day-button/RangeCalendarDayButton.vue';
import type {
  RangeCalendarDayButtonProps,
  RangeCalendarDayButtonState,
} from './day-button/RangeCalendarDayButton.vue';
import RangeCalendarDay from './day/RangeCalendarDay.vue';
import type { RangeCalendarDayProps, RangeCalendarDayState } from './day/RangeCalendarDay.vue';
import RangeCalendarRoot from './root/RangeCalendarRoot.vue';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootChangeEventReason,
  RangeCalendarRootProps,
  RangeCalendarRootState,
} from './root/RangeCalendarRoot.vue';
import type { RangeValue } from './root/RangeCalendarRootContext';
import type { DateValue } from '../internals/date-time/temporal';

/**
 * Groups all parts of the range calendar and holds the first and the last day of the range, the
 * month that the grid shows and the day that has the tab stop.
 * Renders a `<div>` element.
 */
export const Root: typeof RangeCalendarRoot = RangeCalendarRoot;
export namespace Root {
  export type Props<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootProps<Value>;
  export type State = RangeCalendarRootState;
  export type Value<Value extends DateValue = Temporal.PlainDate> = RangeValue<Value>;
  export type ChangeEventReason = RangeCalendarRootChangeEventReason;
  export type ChangeEventDetails = RangeCalendarRootChangeEventDetails;
}

/**
 * The cell of a day. It holds the state of the day and the day button.
 * Renders a `<td>` element.
 */
export const Day: typeof RangeCalendarDay = RangeCalendarDay;
export namespace Day {
  export type Props = RangeCalendarDayProps;
  export type State = RangeCalendarDayState;
}

/**
 * The button that picks a day, and that has the tab stop when its day has it. A press on it, and a
 * drag from it, pick the days of the range.
 * Renders a `<button>` element.
 */
export const DayButton: typeof RangeCalendarDayButton = RangeCalendarDayButton;
export namespace DayButton {
  export type Props = RangeCalendarDayButtonProps;
  export type State = RangeCalendarDayButtonState;
}

export {
  Months,
  Month,
  Grid,
  GridHeader,
  GridHeaderRow,
  Weekday,
  GridBody,
  Week,
  Caption,
  MonthSelect,
  YearSelect,
  PreviousButton,
  NextButton,
  WeekNumberHeader,
  WeekNumber,
  Footer,
} from '../calendar/index.parts';
