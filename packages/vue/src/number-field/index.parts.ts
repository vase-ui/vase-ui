import NumberFieldDecrement from './decrement/NumberFieldDecrement.vue';
import type {
  NumberFieldDecrementProps,
  NumberFieldDecrementState,
} from './decrement/NumberFieldDecrement.vue';
import NumberFieldGroup from './group/NumberFieldGroup.vue';
import type { NumberFieldGroupProps, NumberFieldGroupState } from './group/NumberFieldGroup.vue';
import NumberFieldIncrement from './increment/NumberFieldIncrement.vue';
import type {
  NumberFieldIncrementProps,
  NumberFieldIncrementState,
} from './increment/NumberFieldIncrement.vue';
import NumberFieldInput from './input/NumberFieldInput.vue';
import type { NumberFieldInputProps, NumberFieldInputState } from './input/NumberFieldInput.vue';
import NumberFieldRoot from './root/NumberFieldRoot.vue';
import type {
  NumberFieldRootChangeEventDetails,
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootCommitEventReason,
  NumberFieldRootProps,
  NumberFieldRootState,
} from './root/NumberFieldRoot.vue';

/**
 * Groups all parts of the number field and manages its state.
 * Renders a `<div>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof NumberFieldRoot = NumberFieldRoot;
export namespace Root {
  export type State = NumberFieldRootState;
  export type Props = NumberFieldRootProps;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}

/**
 * Groups the input with the increment and decrement buttons.
 * Renders a `<div>` element.
 */
export const Group: typeof NumberFieldGroup = NumberFieldGroup;
export namespace Group {
  export type State = NumberFieldGroupState;
  export type Props = NumberFieldGroupProps;
}

/**
 * A stepper button that increases the field value when clicked.
 * Renders a `<button>` element.
 */
export const Increment: typeof NumberFieldIncrement = NumberFieldIncrement;
export namespace Increment {
  export type State = NumberFieldIncrementState;
  export type Props = NumberFieldIncrementProps;
}

/**
 * A stepper button that decreases the field value when clicked.
 * Renders a `<button>` element.
 */
export const Decrement: typeof NumberFieldDecrement = NumberFieldDecrement;
export namespace Decrement {
  export type State = NumberFieldDecrementState;
  export type Props = NumberFieldDecrementProps;
}

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 */
export const Input: typeof NumberFieldInput = NumberFieldInput;
export namespace Input {
  export type State = NumberFieldInputState;
  export type Props = NumberFieldInputProps;
}
