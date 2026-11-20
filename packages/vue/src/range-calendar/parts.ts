import type { DateValue } from '../internals/date-time/temporal';
import RangeCalendarRoot from './RangeCalendarRoot.vue';
import type {
  RangeCalendarRootChangeEventDetails,
  RangeCalendarRootChangeEventReason,
  RangeCalendarRootProps,
  RangeCalendarRootState,
  RangeCalendarRootValue,
} from './types';

/**
 * Groups the parts of `Calendar` for a range of days.
 * Renders a `<div>` element.
 */
export const Root: typeof RangeCalendarRoot = RangeCalendarRoot;
export namespace Root {
  export type Props<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootProps<Value>;
  export type State = RangeCalendarRootState;
  export type Value<Value extends DateValue = Temporal.PlainDate> = RangeCalendarRootValue<Value>;
  export type ChangeEventReason = RangeCalendarRootChangeEventReason;
  export type ChangeEventDetails = RangeCalendarRootChangeEventDetails;
}
