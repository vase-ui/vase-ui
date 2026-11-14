import OTPFieldRoot from './root/OTPFieldRoot.vue';
import type {
  OTPFieldRootChangeEventDetails,
  OTPFieldRootChangeEventReason,
  OTPFieldRootCompleteEventDetails,
  OTPFieldRootCompleteEventReason,
  OTPFieldRootInvalidEventDetails,
  OTPFieldRootInvalidEventReason,
  OTPFieldRootProps,
  OTPFieldRootState,
  OTPFieldRootValidationType,
} from './root/OTPFieldRoot.vue';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof OTPFieldRoot = OTPFieldRoot;
export namespace Root {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPFieldRootValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

export { Separator } from '../separator';
