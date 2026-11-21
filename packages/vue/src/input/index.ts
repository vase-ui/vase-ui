import InputComponent from './Input.vue';
import type {
  InputChangeEventDetails,
  InputChangeEventReason,
  InputEmits,
  InputProps,
  InputState,
} from './types';

/**
 * A native input element that works with Field.
 * Renders an `<input>` element.
 * @selector `:disabled` The input is disabled.
 * @selector `:read-only` The input is read-only or disabled.
 * @selector `[data-filled]` In a field, the input has text.
 * @selector `[data-valid]` The field of the input is valid.
 * @selector `[aria-invalid="true"]` The field of the input is invalid.
 * @selector `[data-touched]` In a field, the focus left the input.
 * @selector `[data-dirty]` In a field, the text differs from the first text.
 */
export const Input: typeof InputComponent = InputComponent;
export namespace Input {
  export type Props = InputProps;
  export type Emits = InputEmits;
  export type State = InputState;
  export type ChangeEventReason = InputChangeEventReason;
  export type ChangeEventDetails = InputChangeEventDetails;
}

export type { InputChangeEventDetails, InputChangeEventReason, InputEmits, InputProps, InputState };
