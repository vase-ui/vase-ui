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
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
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
 * Renders a `<label>` element for the input of the first thumb. The root and each input with no
 * `aria-label` or `aria-labelledby` of their own name the label.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 */
export const Label: typeof SliderLabel = SliderLabel;
export namespace Label {
  export type Props = SliderLabelProps;
  export type State = SliderLabelState;
}

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 */
export const Value: typeof SliderValue = SliderValue;
export namespace Value {
  export type State = SliderValueState;
}

/**
 * The clickable, interactive part of the slider. A press moves the nearest thumb to the pointer,
 * and a drag moves the thumb with the pointer. The inline style `touch-action: none` stops the
 * scroll of the page at a touch drag. To let the page scroll across a horizontal slider, give the
 * control the style `touch-action: pan-y`.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 */
export const Control: typeof SliderControl = SliderControl;
export namespace Control {
  export type Props = SliderControlProps;
  export type State = SliderControlState;
}

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 */
export const Track: typeof SliderTrack = SliderTrack;
export namespace Track {
  export type Props = SliderTrackProps;
  export type State = SliderTrackState;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 */
export const Indicator: typeof SliderIndicator = SliderIndicator;
export namespace Indicator {
  export type Props = SliderIndicatorProps;
  export type State = SliderIndicatorState;
}

/**
 * The draggable part of the slider at the tip of the indicator. The input gets each `aria-*`
 * attribute, `tabindex`, `autofocus`, and the `focus`, `blur` and `keydown` listeners. The thumb
 * element gets each other attribute.
 * Renders a `<div>` element with a range `<input>` element in it.
 * @selector `[data-orientation]` The orientation of the slider: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The slider or the thumb is disabled.
 * @selector `[data-dragging]` The user presses the control with a pointer.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the slider one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `:has(:focus-visible)` The input of the thumb shows a focus ring.
 */
export const Thumb: typeof SliderThumb = SliderThumb;
export namespace Thumb {
  export type Props = SliderThumbProps;
  export type State = SliderThumbState;
}
