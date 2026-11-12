import MeterIndicator from './indicator/MeterIndicator.vue';
import type { MeterIndicatorProps, MeterIndicatorState } from './indicator/MeterIndicator.vue';
import MeterLabel from './label/MeterLabel.vue';
import type { MeterLabelProps, MeterLabelState } from './label/MeterLabel.vue';
import MeterRoot from './root/MeterRoot.vue';
import type { MeterRootProps, MeterRootState } from './root/MeterRoot.vue';
import MeterTrack from './track/MeterTrack.vue';
import type { MeterTrackProps, MeterTrackState } from './track/MeterTrack.vue';
import MeterValue from './value/MeterValue.vue';
import type { MeterValueProps, MeterValueState } from './value/MeterValue.vue';

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 */
export const Root: typeof MeterRoot = MeterRoot;
export namespace Root {
  export type Props = MeterRootProps;
  export type State = MeterRootState;
}

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 */
export const Track: typeof MeterTrack = MeterTrack;
export namespace Track {
  export type Props = MeterTrackProps;
  export type State = MeterTrackState;
}

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 */
export const Indicator: typeof MeterIndicator = MeterIndicator;
export namespace Indicator {
  export type Props = MeterIndicatorProps;
  export type State = MeterIndicatorState;
}

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 */
export const Value: typeof MeterValue = MeterValue;
export namespace Value {
  export type Props = MeterValueProps;
  export type State = MeterValueState;
}

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 */
export const Label: typeof MeterLabel = MeterLabel;
export namespace Label {
  export type Props = MeterLabelProps;
  export type State = MeterLabelState;
}
