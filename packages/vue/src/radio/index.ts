import RadioComponent from './Radio.vue';
import type { RadioProps, RadioState } from './types';

export const Radio: typeof RadioComponent = RadioComponent;
export namespace Radio {
  export type Props<Value = any> = RadioProps<Value>;
  export type State = RadioState;
}

export type { RadioProps, RadioState };
