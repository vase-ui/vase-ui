import InputComponent from './Input.vue';
import type {
  InputChangeEventDetails,
  InputChangeEventReason,
  InputProps,
  InputState,
} from './Input.vue';

/**
 * A native input element that automatically works with Field.
 * Renders an `<input>` element.
 */
export const Input: typeof InputComponent = InputComponent;
export namespace Input {
  export type Props = InputProps;
  export type State = InputState;
  export type ChangeEventReason = InputChangeEventReason;
  export type ChangeEventDetails = InputChangeEventDetails;
}

export type * from './Input.vue';

export * as InputDataAttributes from './InputDataAttributes';
