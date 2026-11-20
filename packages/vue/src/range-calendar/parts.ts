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
  export type Props = RangeCalendarRootProps;
  export type State = RangeCalendarRootState;
  export type Value = RangeCalendarRootValue;
  export type ChangeEventReason = RangeCalendarRootChangeEventReason;
  export type ChangeEventDetails = RangeCalendarRootChangeEventDetails;
}
