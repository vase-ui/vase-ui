import ProgressIndicator from './ProgressIndicator.vue';
import ProgressLabel from './ProgressLabel.vue';
import ProgressRoot from './ProgressRoot.vue';
import ProgressTrack from './ProgressTrack.vue';
import ProgressValue from './ProgressValue.vue';
import type {
  ProgressIndicatorProps,
  ProgressIndicatorState,
  ProgressLabelProps,
  ProgressLabelState,
  ProgressRootProps,
  ProgressRootState,
  ProgressTrackProps,
  ProgressTrackState,
  ProgressValueProps,
  ProgressValueState,
} from './types';

export type { ProgressStatus as Status } from './types';

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Without a `Progress.Label`, give it `aria-label` or `aria-labelledby`. With the `element` slot,
 * put text in your element, such as a `Progress.Label`: NVDA and JAWS can need text in a progress
 * bar to say its name.
 * Renders a `<div>` element with the role `progressbar`.
 * @selector `[data-indeterminate]` The progress has no value.
 * @selector `[data-progressing]` The value is less than `max`.
 * @selector `[data-complete]` The value is `max`.
 */
export const Root: typeof ProgressRoot = ProgressRoot;
export namespace Root {
  export type Props = ProgressRootProps;
  export type State = ProgressRootState;
}

/**
 * Contains the progress bar indicator.
 * Renders a `<div>` element.
 * @selector `[data-indeterminate]` The progress has no value.
 * @selector `[data-progressing]` The value is less than `max`.
 * @selector `[data-complete]` The value is `max`.
 */
export const Track: typeof ProgressTrack = ProgressTrack;
export namespace Track {
  export type Props = ProgressTrackProps;
  export type State = ProgressTrackState;
}

/**
 * Visualizes the completion status of the task. It has the inline style `inset-inline-start: 0`,
 * `height: inherit` and a `width` with the percent of the range, except while the progress is
 * indeterminate.
 * Renders a `<div>` element.
 * @selector `[data-indeterminate]` The progress has no value.
 * @selector `[data-progressing]` The value is less than `max`.
 * @selector `[data-complete]` The value is `max`.
 */
export const Indicator: typeof ProgressIndicator = ProgressIndicator;
export namespace Indicator {
  export type Props = ProgressIndicatorProps;
  export type State = ProgressIndicatorState;
}

/**
 * A text element that shows the current value.
 * Renders a `<span>` element.
 * @selector `[data-indeterminate]` The progress has no value.
 * @selector `[data-progressing]` The value is less than `max`.
 * @selector `[data-complete]` The value is `max`.
 */
export const Value: typeof ProgressValue = ProgressValue;
export namespace Value {
  export type Props = ProgressValueProps;
  export type State = ProgressValueState;
}

/**
 * An accessible label for the progress bar. Use one in each progress bar.
 * Renders a `<span>` element.
 * @selector `[data-indeterminate]` The progress has no value.
 * @selector `[data-progressing]` The value is less than `max`.
 * @selector `[data-complete]` The value is `max`.
 */
export const Label: typeof ProgressLabel = ProgressLabel;
export namespace Label {
  export type Props = ProgressLabelProps;
  export type State = ProgressLabelState;
}
