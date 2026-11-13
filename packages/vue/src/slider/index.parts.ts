import SliderControl from './control/SliderControl.vue';
import type { SliderControlProps, SliderControlState } from './control/SliderControl.vue';
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
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 */
export const Control: typeof SliderControl = SliderControl;
export namespace Control {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
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
