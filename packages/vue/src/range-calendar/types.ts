/// <reference lib="esnext.temporal" preserve="true" />
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { CalendarBaseProps, CalendarRootState } from '../calendar/types';
import type { DateValue } from '../common/date-time/temporal';

/** The first and the last day of a range. A range in progress has its first day and `null`. */
export type RangeCalendarRootValue<Value extends DateValue = Temporal.PlainDate> = [
  start: Value | null,
  end: Value | null,
];

/**
 * - `day-press`: a press on a day.
 * - `drag`: a drag over the days.
 * - `keyboard`: a key in the grid, or Escape.
 * - `month-change`: a press on a navigation button, or a change of a select.
 * - `none`: a day got the focus.
 */
export type RangeCalendarRootChangeEventReason =
  'day-press' | 'drag' | 'keyboard' | 'month-change' | 'none';

export type RangeCalendarRootChangeEventDetails =
  ChangeEventDetails<RangeCalendarRootChangeEventReason>;

export interface RangeCalendarRootProps<
  Value extends DateValue = Temporal.PlainDate,
> extends CalendarBaseProps {
  /**
   * The first and the last day of the range. `v-model` binds it. `[start, null]` is a range in
   * progress, and `[null, null]` is no range. A new end has the kind, the time, the zone and the
   * calendar of the end that it replaces, else of the other end, else of `defaultValue`, else of the
   * last end. With none of them, it is a `Temporal.PlainDate`.
   */
  modelValue?: readonly [Value | null, Value | null] | undefined;
  /** The range at the mount of an uncontrolled calendar. It also gives the kind of a new end. */
  defaultValue?: readonly [Value | null, Value | null] | undefined;
  /**
   * The least number of days of a range. The two ends count. A press that makes a shorter range
   * starts a new range.
   */
  minDays?: number | undefined;
  /**
   * The greatest number of days of a range. The two ends count. A press that makes a longer range
   * starts a new range, and a drag stops at this number.
   */
  maxDays?: number | undefined;
  /**
   * A range can cross a day that is disabled or unavailable. That day is then in the range and not
   * selected. Without it, a drag stops before such a day.
   * @default false
   */
  allowNonContiguousRanges?: boolean | undefined;
}

export interface RangeCalendarRootState extends CalendarRootState {
  /** The user picked the first day and not yet the last day, or drags a range. */
  selecting: boolean;
}
