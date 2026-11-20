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

export const Root: typeof ProgressRoot = ProgressRoot;
export namespace Root {
  export type Props = ProgressRootProps;
  export type State = ProgressRootState;
}

export const Track: typeof ProgressTrack = ProgressTrack;
export namespace Track {
  export type Props = ProgressTrackProps;
  export type State = ProgressTrackState;
}

export const Indicator: typeof ProgressIndicator = ProgressIndicator;
export namespace Indicator {
  export type Props = ProgressIndicatorProps;
  export type State = ProgressIndicatorState;
}

export const Value: typeof ProgressValue = ProgressValue;
export namespace Value {
  export type Props = ProgressValueProps;
  export type State = ProgressValueState;
}

export const Label: typeof ProgressLabel = ProgressLabel;
export namespace Label {
  export type Props = ProgressLabelProps;
  export type State = ProgressLabelState;
}
