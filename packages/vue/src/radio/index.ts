import RadioComponent from './Radio.vue';
import type { RadioProps, RadioState } from './types';

/**
 * A radio button that the user can select, in a `RadioGroup`.
 * Renders an `<input>` element with the type `radio`.
 * @selector `:checked` The radio is selected.
 * @selector `:disabled` The radio is disabled.
 * @selector `:required` The group is required, and the radio is not read-only.
 * @selector `[data-readonly]` The radio is read-only.
 * @selector `[data-valid]` The field of the group is valid.
 * @selector `[data-invalid]` The field of the group is invalid.
 * @selector `[data-touched]` In a field, the focus left the group.
 * @selector `[data-dirty]` In a field, the value differs from the first value.
 */
export const Radio: typeof RadioComponent = RadioComponent;
export namespace Radio {
  export type Props<Value = any> = RadioProps<Value>;
  export type State = RadioState;
}

export type { RadioProps, RadioState };
