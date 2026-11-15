/// <reference lib="esnext.temporal" preserve="true" />
import TemporalPartComponent from './TemporalPart.vue';
import type { TemporalPartProps } from './TemporalPart.vue';

export const TemporalPart: typeof TemporalPartComponent = TemporalPartComponent;
export namespace TemporalPart {
  export type Props = TemporalPartProps;
}

export type * from './TemporalPart.vue';
