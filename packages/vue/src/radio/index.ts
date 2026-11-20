import RadioComponent from './Radio.vue';
import type { RadioProps, RadioState } from './types';

/**
 * A radio button that the user can select.
 * Renders an `<input>` element with the type `radio`.
 */
export const Radio: typeof RadioComponent = RadioComponent;
export namespace Radio {
  export type Props<Value = any> = RadioProps<Value>;
  export type State = RadioState;
}

export type { RadioProps, RadioState };
