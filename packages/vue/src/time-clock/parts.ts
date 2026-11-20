import type { TimeValue } from '../internals/date-time/temporal';
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
 */
export const Root: typeof TimeClockRoot = TimeClockRoot;
export namespace Root {
  export type Props<Value extends TimeValue = Temporal.PlainTime> = TimeClockRootProps<Value>;
  export type State = TimeClockRootState;
  export type ChangeEventReason = TimeClockRootChangeEventReason;
  export type ChangeEventDetails = TimeClockRootChangeEventDetails;
  export type CommitEventReason = TimeClockRootCommitEventReason;
  export type CommitEventDetails = TimeClockRootCommitEventDetails;
  export type ViewChangeEventReason = TimeClockRootViewChangeEventReason;
  export type ViewChangeEventDetails = TimeClockRootViewChangeEventDetails;
}

/**
 * Shows the numbers of the view, and takes a press, a drag and the keys.
 * Renders a `<div>` element with a range `<input>` element in it.
 */
export const Face: typeof TimeClockFace = TimeClockFace;
export namespace Face {
  export type Props = TimeClockFaceProps;
  export type State = TimeClockFaceState;
}

/**
 * Points at the number of the time.
 * Renders a `<div>` element while the clock has a value.
 */
export const Hand: typeof TimeClockHand = TimeClockHand;
export namespace Hand {
  export type Props = TimeClockHandProps;
  export type State = TimeClockHandState;
}

/**
 * Shows one number of the face.
 * Renders a `<span>` element.
 */
export const Number: typeof TimeClockNumber = TimeClockNumber;
export namespace Number {
  export type Props = TimeClockNumberProps;
  export type State = TimeClockNumberState;
}

/**
 * Moves the time to its half of the day.
 * Renders a `<button>` element on a face of 12 hours.
 */
export const DayPeriod: typeof TimeClockDayPeriod = TimeClockDayPeriod;
export namespace DayPeriod {
  export type Props = TimeClockDayPeriodProps;
  export type State = TimeClockDayPeriodState;
}

/**
 * Shows its view on the face.
 * Renders a `<button>` element.
 */
export const ViewTrigger: typeof TimeClockViewTrigger = TimeClockViewTrigger;
export namespace ViewTrigger {
  export type Props = TimeClockViewTriggerProps;
  export type State = TimeClockViewTriggerState;
}
