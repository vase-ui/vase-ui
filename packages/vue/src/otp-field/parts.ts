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
 * Renders a `<div>` element with the role `group`. Its last child is a hidden `<input>` that gives
 * the code to a form. Do not select the last slot with `:last-child` or `:last-of-type`.
 * @selector `[data-complete]` Each slot has a character.
 * @selector `[data-filled]` A slot has a character.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-valid]` The code is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The code is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The code differs from the first code, in a `Field.Root`.
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
 * @selector `[data-complete]` Each slot has a character.
 * @selector `[data-filled]` The slot has a character.
 * @selector `:disabled` The field is disabled.
 * @selector `:read-only` The field is read-only or disabled.
 * @selector `:required` The field is required.
 * @selector `[aria-invalid="true"]` The code is invalid, in a `Field.Root`.
 * @selector `[data-valid]` The code is valid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The code differs from the first code, in a `Field.Root`.
 */
export const Input: typeof OTPFieldInput = OTPFieldInput;
export namespace Input {
  export type State = OTPFieldInputState;
}

export { Separator } from '../separator';
