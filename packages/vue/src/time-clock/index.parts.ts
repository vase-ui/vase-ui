import type { TimeValue } from '../internals/date-time/temporal';
import TimeClockDayPeriod from './day-period/TimeClockDayPeriod.vue';
import type {
  TimeClockDayPeriodProps,
  TimeClockDayPeriodState,
} from './day-period/TimeClockDayPeriod.vue';
import TimeClockFace from './face/TimeClockFace.vue';
import type { TimeClockFaceProps, TimeClockFaceState } from './face/TimeClockFace.vue';
import TimeClockHand from './hand/TimeClockHand.vue';
import type { TimeClockHandProps, TimeClockHandState } from './hand/TimeClockHand.vue';
import TimeClockNumber from './number/TimeClockNumber.vue';
import type { TimeClockNumberProps, TimeClockNumberState } from './number/TimeClockNumber.vue';
import TimeClockRoot from './root/TimeClockRoot.vue';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootChangeEventReason,
  TimeClockRootCommitEventDetails,
  TimeClockRootCommitEventReason,
  TimeClockRootProps,
  TimeClockRootState,
} from './root/TimeClockRoot.vue';
import TimeClockViewTrigger from './view-trigger/TimeClockViewTrigger.vue';
import type {
  TimeClockViewTriggerProps,
  TimeClockViewTriggerState,
} from './view-trigger/TimeClockViewTrigger.vue';

/**
 * Groups all parts of the clock.
 * Renders a `<div>` element.
 */
export const Root: typeof TimeClockRoot = TimeClockRoot;
export namespace Root {
  export type State = TimeClockRootState;
  export type Props<Value extends TimeValue = TimeValue> = TimeClockRootProps<Value>;
  export type ChangeEventReason = TimeClockRootChangeEventReason;
  export type ChangeEventDetails = TimeClockRootChangeEventDetails;
  export type CommitEventReason = TimeClockRootCommitEventReason;
  export type CommitEventDetails = TimeClockRootCommitEventDetails;
}

/**
 * The clickable face of the clock. It keeps a range input for assistive technology.
 * Renders a `<div>` element and a nested `<input type="range">`.
 */
export const Face: typeof TimeClockFace = TimeClockFace;
export namespace Face {
  export type State = TimeClockFaceState;
  export type Props = TimeClockFaceProps;
}

/**
 * The hand of the clock. It points at the selected number. It renders nothing while the clock has no value.
 * Renders a `<div>` element.
 */
export const Hand: typeof TimeClockHand = TimeClockHand;
export namespace Hand {
  export type State = TimeClockHandState;
  export type Props = TimeClockHandProps;
}

/**
 * A number of the face.
 * Renders a `<span>` element.
 */
export const Number: typeof TimeClockNumber = TimeClockNumber;
export namespace Number {
  export type State = TimeClockNumberState;
  export type Props = TimeClockNumberProps;
}

/**
 * A button that selects the day period of a 12-hour clock. It renders nothing on a 24-hour clock.
 * Renders a `<button>` element.
 */
export const DayPeriod: typeof TimeClockDayPeriod = TimeClockDayPeriod;
export namespace DayPeriod {
  export type State = TimeClockDayPeriodState;
  export type Props = TimeClockDayPeriodProps;
}

/**
 * A button that shows the hours, the minutes or the seconds on the face.
 * Renders a `<button>` element.
 */
export const ViewTrigger: typeof TimeClockViewTrigger = TimeClockViewTrigger;
export namespace ViewTrigger {
  export type State = TimeClockViewTriggerState;
  export type Props = TimeClockViewTriggerProps;
}
