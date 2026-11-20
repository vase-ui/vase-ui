import OTPFieldInput from './OTPFieldInput.vue';
import OTPFieldRoot from './OTPFieldRoot.vue';
import type {
  OTPFieldInputState,
  OTPFieldRootChangeEventDetails,
  OTPFieldRootChangeEventReason,
  OTPFieldRootCompleteEventDetails,
  OTPFieldRootCompleteEventReason,
  OTPFieldRootInvalidEventDetails,
  OTPFieldRootInvalidEventReason,
  OTPFieldRootProps,
  OTPFieldRootState,
  OTPFieldRootValidationType,
} from './types';

// The API reference of the docs reads the description of a part from the JSDoc of its export.

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element. Its last child is a hidden `<input>` that holds the code.
 */
export const Root: typeof OTPFieldRoot = OTPFieldRoot;
export namespace Root {
  export type Props = OTPFieldRootProps;
  export type State = OTPFieldRootState;
  export type ValidationType = OTPFieldRootValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 */
export const Input: typeof OTPFieldInput = OTPFieldInput;
export namespace Input {
  export type State = OTPFieldInputState;
}

export { Separator } from '../separator';
