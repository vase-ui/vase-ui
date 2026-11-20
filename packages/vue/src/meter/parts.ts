import MeterIndicator from './MeterIndicator.vue';
import MeterLabel from './MeterLabel.vue';
import MeterRoot from './MeterRoot.vue';
import MeterTrack from './MeterTrack.vue';
import MeterValue from './MeterValue.vue';
import type {
  MeterIndicatorProps,
  MeterLabelProps,
  MeterRootProps,
  MeterTrackProps,
  MeterValueProps,
} from './types';

/**
 * Groups all parts of the meter and provides the value for screen readers. Without a
 * `Meter.Label`, give it `aria-label` or `aria-labelledby`. With the `element` slot, put text in
 * your element, such as a `Meter.Label`: NVDA and JAWS can need text in a meter to say its name.
 * Renders a `<div>` element with the role `meter`.
 */
export const Root: typeof MeterRoot = MeterRoot;
export namespace Root {
  export type Props = MeterRootProps;
}

/**
 * An accessible label for the meter. Use one in each meter.
 * Renders a `<span>` element.
 */
export const Label: typeof MeterLabel = MeterLabel;
export namespace Label {
  export type Props = MeterLabelProps;
}

/**
 * A text element that shows the current value.
 * Renders a `<span>` element.
 */
export const Value: typeof MeterValue = MeterValue;
export namespace Value {
  export type Props = MeterValueProps;
}

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 */
export const Track: typeof MeterTrack = MeterTrack;
export namespace Track {
  export type Props = MeterTrackProps;
}

/**
 * Visualizes the position of the value along the range. It has the inline style
 * `inset-inline-start: 0`, `height: inherit` and a `width` with the percent of the range.
 * Renders a `<div>` element.
 */
export const Indicator: typeof MeterIndicator = MeterIndicator;
export namespace Indicator {
  export type Props = MeterIndicatorProps;
}
