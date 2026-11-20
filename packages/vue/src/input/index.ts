import InputComponent from './Input.vue';
import type {
  InputChangeEventDetails,
  InputChangeEventReason,
  InputProps,
  InputState,
} from './types';

export const Input: typeof InputComponent = InputComponent;
export namespace Input {
  export type Props = InputProps;
  export type State = InputState;
  export type ChangeEventReason = InputChangeEventReason;
  export type ChangeEventDetails = InputChangeEventDetails;
}

export type { InputChangeEventDetails, InputChangeEventReason, InputProps, InputState };
