import NumberFieldDecrement from './NumberFieldDecrement.vue';
import NumberFieldGroup from './NumberFieldGroup.vue';
import NumberFieldIncrement from './NumberFieldIncrement.vue';
import NumberFieldInput from './NumberFieldInput.vue';
import NumberFieldRoot from './NumberFieldRoot.vue';
import NumberFieldScrubArea from './NumberFieldScrubArea.vue';
import type {
  NumberFieldDecrementProps,
  NumberFieldDecrementState,
  NumberFieldGroupProps,
  NumberFieldGroupState,
  NumberFieldIncrementProps,
  NumberFieldIncrementState,
  NumberFieldInputProps,
  NumberFieldInputState,
  NumberFieldRootChangeEventDetails,
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootCommitEventReason,
  NumberFieldRootProps,
  NumberFieldRootState,
  NumberFieldScrubAreaProps,
  NumberFieldScrubAreaState,
} from './types';

/**
 * Groups all parts of the number field and manages its state.
 * Renders a `<div>` element with a hidden form `<input>` element in it.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const Root: typeof NumberFieldRoot = NumberFieldRoot;
export namespace Root {
  export type Props = NumberFieldRootProps;
  export type State = NumberFieldRootState;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}

/**
 * Groups the input with the increment and decrement buttons.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const Group: typeof NumberFieldGroup = NumberFieldGroup;
export namespace Group {
  export type Props = NumberFieldGroupProps;
  export type State = NumberFieldGroupState;
}

/**
 * The native input control in the number field.
 * Renders an `<input>` element with the role `spinbutton`.
 * @selector `:disabled` The field is disabled.
 * @selector `:read-only` The field is read-only or disabled.
 * @selector `:required` The field is required.
 * @selector `[aria-invalid="true"]` The value is out of the range, or it is invalid in a `Field.Root`.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const Input: typeof NumberFieldInput = NumberFieldInput;
export namespace Input {
  export type Props = NumberFieldInputProps;
  export type State = NumberFieldInputState;
}

/**
 * A stepper button that increases the field value when the user clicks it.
 * Renders a `<button>` element.
 * @selector `:disabled` The button cannot step the value: the button or the field is disabled, the field is read-only, or the value is at its bound.
 * @selector `[aria-disabled="true"]` The button cannot step the value, and it is not a native button.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const Increment: typeof NumberFieldIncrement = NumberFieldIncrement;
export namespace Increment {
  export type Props = NumberFieldIncrementProps;
  export type State = NumberFieldIncrementState;
}

/**
 * A stepper button that decreases the field value when the user clicks it.
 * Renders a `<button>` element.
 * @selector `:disabled` The button cannot step the value: the button or the field is disabled, the field is read-only, or the value is at its bound.
 * @selector `[aria-disabled="true"]` The button cannot step the value, and it is not a native button.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const Decrement: typeof NumberFieldDecrement = NumberFieldDecrement;
export namespace Decrement {
  export type Props = NumberFieldDecrementProps;
  export type State = NumberFieldDecrementState;
}

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-readonly]` The field is read-only.
 * @selector `[data-required]` The field is required.
 * @selector `[data-scrubbing]` The user drags in a scrub area of the field.
 * @selector `[data-valid]` The value is valid, in a `Field.Root`.
 * @selector `[data-invalid]` The value is invalid, in a `Field.Root`.
 * @selector `[data-touched]` The focus left the field one time or more, in a `Field.Root`.
 * @selector `[data-dirty]` The value differs from the first value, in a `Field.Root`.
 * @selector `[data-filled]` The field has a value, in a `Field.Root`.
 */
export const ScrubArea: typeof NumberFieldScrubArea = NumberFieldScrubArea;
export namespace ScrubArea {
  export type Props = NumberFieldScrubAreaProps;
  export type State = NumberFieldScrubAreaState;
}
