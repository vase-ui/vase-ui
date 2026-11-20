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

export const Face: typeof TimeClockFace = TimeClockFace;
export namespace Face {
  export type Props = TimeClockFaceProps;
  export type State = TimeClockFaceState;
}

export const Hand: typeof TimeClockHand = TimeClockHand;
export namespace Hand {
  export type Props = TimeClockHandProps;
  export type State = TimeClockHandState;
}

export const Number: typeof TimeClockNumber = TimeClockNumber;
export namespace Number {
  export type Props = TimeClockNumberProps;
  export type State = TimeClockNumberState;
}

export const DayPeriod: typeof TimeClockDayPeriod = TimeClockDayPeriod;
export namespace DayPeriod {
  export type Props = TimeClockDayPeriodProps;
  export type State = TimeClockDayPeriodState;
}

export const ViewTrigger: typeof TimeClockViewTrigger = TimeClockViewTrigger;
export namespace ViewTrigger {
  export type Props = TimeClockViewTriggerProps;
  export type State = TimeClockViewTriggerState;
}
