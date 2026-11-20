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

export const Root: typeof MeterRoot = MeterRoot;
export namespace Root {
  export type Props = MeterRootProps;
}

export const Label: typeof MeterLabel = MeterLabel;
export namespace Label {
  export type Props = MeterLabelProps;
}

export const Value: typeof MeterValue = MeterValue;
export namespace Value {
  export type Props = MeterValueProps;
}

export const Track: typeof MeterTrack = MeterTrack;
export namespace Track {
  export type Props = MeterTrackProps;
}

export const Indicator: typeof MeterIndicator = MeterIndicator;
export namespace Indicator {
  export type Props = MeterIndicatorProps;
}
