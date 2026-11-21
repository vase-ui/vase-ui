import type { DateValue } from '../common/date-time/temporal';
import RangeCalendarRoot from './RangeCalendarRoot.vue';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootChangeEventReason,
  RangeCalendarRootEmits,
  RangeCalendarRootProps,
  RangeCalendarRootState,
  RangeCalendarRootValue,
} from './types';

/**
 * Groups the parts of `Calendar` for a range of days.
 * Renders a `<div>` element.
 * @selector `[data-selecting]` The user picked the first day and not the last day, or drags a range.
 * @selector `[data-navigation-direction]` The side of the last move of the page: `previous`, `next` or `none`.
 * @selector `[data-disabled]` The calendar is disabled.
 * @selector `[data-readonly]` The calendar is read-only.
 * @selector `[data-invalid]` The value of the calendar is not valid.
 * @selector `[data-empty]` No day is selected.
 */
export const Root: typeof RangeCalendarRoot = RangeCalendarRoot;
export namespace Root {
  export type Props<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootProps<Value>;
  export type Emits<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootEmits<Value>;
  export type State = RangeCalendarRootState;
  export type Value<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootValue<Value>;
  export type ChangeEventReason = RangeCalendarRootChangeEventReason;
  export type ChangeEventDetails = RangeCalendarRootChangeEventDetails;
}
