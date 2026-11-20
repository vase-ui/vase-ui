import MeterIndicator from './MeterIndicator.vue';
import MeterLabel from './MeterLabel.vue';
import MeterRoot from './MeterRoot.vue';
import MeterTrack from './MeterTrack.vue';
import MeterValue from './MeterValue.vue';
import type { MeterLabelProps, MeterRootProps } from './types';

export const Root: typeof MeterRoot = MeterRoot;
export namespace Root {
  export type Props = MeterRootProps;
}

export const Label: typeof MeterLabel = MeterLabel;
export namespace Label {
  export type Props = MeterLabelProps;
}

export const Value: typeof MeterValue = MeterValue;
export const Track: typeof MeterTrack = MeterTrack;
export const Indicator: typeof MeterIndicator = MeterIndicator;
