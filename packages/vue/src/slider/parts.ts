import SliderControl from './SliderControl.vue';
import SliderIndicator from './SliderIndicator.vue';
import SliderLabel from './SliderLabel.vue';
import SliderRoot from './SliderRoot.vue';
import SliderThumb from './SliderThumb.vue';
import SliderTrack from './SliderTrack.vue';
import SliderValue from './SliderValue.vue';
import type {
  SliderControlProps,
  SliderControlState,
  SliderIndicatorProps,
  SliderIndicatorState,
  SliderLabelProps,
  SliderLabelState,
  SliderRootChangeEventDetails,
  SliderRootChangeEventReason,
  SliderRootCommitEventDetails,
  SliderRootCommitEventReason,
  SliderRootProps,
  SliderRootState,
  SliderThumbProps,
  SliderThumbState,
  SliderTrackProps,
  SliderTrackState,
  SliderValueState,
} from './types';

/**
 * Groups all parts of the slider.
 * Renders a `<div>` element.
 */
export const Root: typeof SliderRoot = SliderRoot;
export namespace Root {
  export type Props<Value extends number | readonly number[] = number> = SliderRootProps<Value>;
  export type State = SliderRootState;
  export type ChangeEventReason = SliderRootChangeEventReason;
  export type ChangeEventDetails = SliderRootChangeEventDetails;
  export type CommitEventReason = SliderRootCommitEventReason;
  export type CommitEventDetails = SliderRootCommitEventDetails;
}

/**
 * An accessible label for the inputs of the slider thumbs.
 * Renders a `<label>` element.
 */
export const Label: typeof SliderLabel = SliderLabel;
export namespace Label {
  export type Props = SliderLabelProps;
  export type State = SliderLabelState;
}

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 */
export const Value: typeof SliderValue = SliderValue;
export namespace Value {
  export type State = SliderValueState;
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 */
export const Control: typeof SliderControl = SliderControl;
export namespace Control {
  export type Props = SliderControlProps;
  export type State = SliderControlState;
}

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 */
export const Track: typeof SliderTrack = SliderTrack;
export namespace Track {
  export type Props = SliderTrackProps;
  export type State = SliderTrackState;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 */
export const Indicator: typeof SliderIndicator = SliderIndicator;
export namespace Indicator {
  export type Props = SliderIndicatorProps;
  export type State = SliderIndicatorState;
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element with a range `<input>` element in it.
 */
export const Thumb: typeof SliderThumb = SliderThumb;
export namespace Thumb {
  export type Props = SliderThumbProps;
  export type State = SliderThumbState;
}
