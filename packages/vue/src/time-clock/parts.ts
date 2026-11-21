import type { TimeValue } from '../common/date-time/temporal';
import TimeClockDayPeriod from './TimeClockDayPeriod.vue';
import TimeClockFace from './TimeClockFace.vue';
import TimeClockHand from './TimeClockHand.vue';
import TimeClockNumber from './TimeClockNumber.vue';
import TimeClockRoot from './TimeClockRoot.vue';
import TimeClockViewTrigger from './TimeClockViewTrigger.vue';
import type {
  TimeClockDayPeriodProps,
  TimeClockDayPeriodState,
  TimeClockFaceProps,
  TimeClockFaceState,
  TimeClockHandProps,
  TimeClockHandState,
  TimeClockNumberProps,
  TimeClockNumberState,
  TimeClockRootChangeEventDetails,
  TimeClockRootChangeEventReason,
  TimeClockRootCommitEventDetails,
  TimeClockRootCommitEventReason,
  TimeClockRootEmits,
  TimeClockRootProps,
  TimeClockRootState,
  TimeClockRootViewChangeEventDetails,
  TimeClockRootViewChangeEventReason,
  TimeClockViewTriggerProps,
  TimeClockViewTriggerState,
} from './types';

/**
 * Groups the parts of a clock and holds its time.
 * Renders a `<div>` element.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-disabled]` The clock is disabled.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @selector `[data-empty]` The clock has no value.
 */
export const Root: typeof TimeClockRoot = TimeClockRoot;
export namespace Root {
  export type Props<Value extends TimeValue = Temporal.PlainTime> = TimeClockRootProps<Value>;
  export type Emits<Value extends TimeValue = Temporal.PlainTime> = TimeClockRootEmits<Value>;
  export type State = TimeClockRootState;
  export type ChangeEventReason = TimeClockRootChangeEventReason;
  export type ChangeEventDetails = TimeClockRootChangeEventDetails;
  export type CommitEventReason = TimeClockRootCommitEventReason;
  export type CommitEventDetails = TimeClockRootCommitEventDetails;
  export type ViewChangeEventReason = TimeClockRootViewChangeEventReason;
  export type ViewChangeEventDetails = TimeClockRootViewChangeEventDetails;
}

/**
 * Shows the numbers of the view, and takes a press, a drag and the keys. The `id` and each `aria-*`
 * attribute of the face go to its range input. The face has no `element` slot, because its element
 * holds the range input.
 * Renders a `<div>` element with a range `<input>` element in it.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-disabled]` The clock is disabled.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @selector `[data-empty]` The clock has no value.
 */
export const Face: typeof TimeClockFace = TimeClockFace;
export namespace Face {
  export type Props = TimeClockFaceProps;
  export type State = TimeClockFaceState;
}

/**
 * Points at the number of the time.
 * Renders a `<div>` element while the clock has a value.
 * @selector `[data-inner]` The hand points at the inner ring of a 24-hour face.
 * @selector `[data-between-numbers]` The hand points between two numbers, such as at the minute 37.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-disabled]` The clock is disabled.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @cssVariable `--time-clock-hand-angle` The angle of the hand, in degrees clockwise from 12 o'clock.
 * @cssVariable `--time-clock-hand-length` The length of the hand, as a ratio of the radius of the outer ring: `1`, or `0.64` for the inner ring.
 */
export const Hand: typeof TimeClockHand = TimeClockHand;
export namespace Hand {
  export type Props = TimeClockHandProps;
  export type State = TimeClockHandState;
}

/**
 * Shows one number of the face.
 * Renders a `<span>` element.
 * @selector `[data-selected]` The time of the clock selects the number.
 * @selector `[data-disabled]` The user cannot select the number, or the clock is disabled.
 * @selector `[data-inner]` The number is on the inner ring of a 24-hour face.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @selector `[data-empty]` The clock has no value.
 * @cssVariable `--time-clock-number-angle` The angle of the number, in degrees clockwise from 12 o'clock.
 * @cssVariable `--time-clock-number-radius` The distance of the number from the center, as a ratio of the radius of the outer ring: `1`, or `0.64` for the inner ring.
 */
export const Number: typeof TimeClockNumber = TimeClockNumber;
export namespace Number {
  export type Props = TimeClockNumberProps;
  export type State = TimeClockNumberState;
}

/**
 * Moves the time to its half of the day.
 * Renders a `<button>` element on a face of 12 hours.
 * @selector `[aria-pressed="true"]` The time of the clock is in the day period.
 * @selector `:disabled` The button is a native button, and the clock is disabled or no hour of the day period is allowed.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @selector `[data-empty]` The clock has no value.
 */
export const DayPeriod: typeof TimeClockDayPeriod = TimeClockDayPeriod;
export namespace DayPeriod {
  export type Props = TimeClockDayPeriodProps;
  export type State = TimeClockDayPeriodState;
}

/**
 * Shows its view on the face, also in a read-only clock. With no content of its own, its name is
 * the unit and the number, such as `hour 10`.
 * Renders a `<button>` element.
 * @selector `[aria-pressed="true"]` The face shows the unit of the trigger.
 * @selector `:disabled` The trigger is a native button, and the clock is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the clock is disabled.
 * @selector `[data-view]` The unit that the face shows: `hour`, `minute` or `second`.
 * @selector `[data-readonly]` The clock is read-only.
 * @selector `[data-dragging]` The user presses or drags on the face.
 * @selector `[data-empty]` The clock has no value.
 */
export const ViewTrigger: typeof TimeClockViewTrigger = TimeClockViewTrigger;
export namespace ViewTrigger {
  export type Props = TimeClockViewTriggerProps;
  export type State = TimeClockViewTriggerState;
}
