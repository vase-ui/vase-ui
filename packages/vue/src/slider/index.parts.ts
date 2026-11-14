import SliderControl from './control/SliderControl.vue';
import type { SliderControlProps, SliderControlState } from './control/SliderControl.vue';
import SliderIndicator from './indicator/SliderIndicator.vue';
import type { SliderIndicatorProps, SliderIndicatorState } from './indicator/SliderIndicator.vue';
import SliderLabel from './label/SliderLabel.vue';
import type { SliderLabelProps, SliderLabelState } from './label/SliderLabel.vue';
import SliderRoot from './root/SliderRoot.vue';
import type {
  SliderRootChangeEventDetails,
  SliderRootChangeEventReason,
  SliderRootCommitEventDetails,
  SliderRootCommitEventReason,
  SliderRootProps,
  SliderRootState,
} from './root/SliderRoot.vue';
import SliderThumb from './thumb/SliderThumb.vue';
import type { SliderThumbProps, SliderThumbState } from './thumb/SliderThumb.vue';
import SliderTrack from './track/SliderTrack.vue';
import type { SliderTrackProps, SliderTrackState } from './track/SliderTrack.vue';

/**
 * Groups all parts of the slider.
 * Renders a `<div>` element.
 */
export const Root: typeof SliderRoot = SliderRoot;
export namespace Root {
  export type State = SliderRootState;
  export type Props<Value extends number | readonly number[] = number | readonly number[]> =
    SliderRootProps<Value>;
  export type ChangeEventReason = SliderRootChangeEventReason;
  export type ChangeEventDetails = SliderRootChangeEventDetails;
  export type CommitEventReason = SliderRootCommitEventReason;
  export type CommitEventDetails = SliderRootCommitEventDetails;
}

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 */
export const Label: typeof SliderLabel = SliderLabel;
export namespace Label {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 */
export const Control: typeof SliderControl = SliderControl;
export namespace Control {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 */
export const Track: typeof SliderTrack = SliderTrack;
export namespace Track {
  export type State = SliderTrackState;
  export type Props = SliderTrackProps;
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 */
export const Thumb: typeof SliderThumb = SliderThumb;
export namespace Thumb {
  export type State = SliderThumbState;
  export type Props = SliderThumbProps;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 */
export const Indicator: typeof SliderIndicator = SliderIndicator;
export namespace Indicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
