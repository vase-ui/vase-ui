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

export const Root: typeof SliderRoot = SliderRoot;
export namespace Root {
  export type Props<Value extends number | readonly number[] = number> = SliderRootProps<Value>;
  export type State = SliderRootState;
  export type ChangeEventReason = SliderRootChangeEventReason;
  export type ChangeEventDetails = SliderRootChangeEventDetails;
  export type CommitEventReason = SliderRootCommitEventReason;
  export type CommitEventDetails = SliderRootCommitEventDetails;
}

export const Label: typeof SliderLabel = SliderLabel;
export namespace Label {
  export type Props = SliderLabelProps;
  export type State = SliderLabelState;
}

export const Value: typeof SliderValue = SliderValue;
export namespace Value {
  export type State = SliderValueState;
}

export const Control: typeof SliderControl = SliderControl;
export namespace Control {
  export type Props = SliderControlProps;
  export type State = SliderControlState;
}

export const Track: typeof SliderTrack = SliderTrack;
export namespace Track {
  export type Props = SliderTrackProps;
  export type State = SliderTrackState;
}

export const Indicator: typeof SliderIndicator = SliderIndicator;
export namespace Indicator {
  export type Props = SliderIndicatorProps;
  export type State = SliderIndicatorState;
}

export const Thumb: typeof SliderThumb = SliderThumb;
export namespace Thumb {
  export type Props = SliderThumbProps;
  export type State = SliderThumbState;
}
