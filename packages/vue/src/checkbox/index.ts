import CheckboxComponent from './Checkbox.vue';
import type {
  CheckboxChangeEventDetails,
  CheckboxChangeEventReason,
  CheckboxEmits,
  CheckboxProps,
  CheckboxState,
} from './types';

/**
 * A box that the user can check and clear.
 * Renders an `<input>` element with the type `checkbox`.
 * @selector `:checked` The checkbox is checked.
 * @selector `[data-indeterminate]` The checkbox is indeterminate. After the mount, `:indeterminate` also matches.
 * @selector `:disabled` The checkbox is disabled.
 * @selector `:required` The checkbox is required and not read-only.
 * @selector `[aria-readonly="true"]` The checkbox is read-only.
 * @selector `[data-valid]` The field of the checkbox is valid.
 * @selector `[aria-invalid="true"]` The field of the checkbox is invalid.
 * @selector `[data-touched]` In a field, the focus left the checkbox.
 * @selector `[data-dirty]` In a field, the value differs from the first value.
 */
export const Checkbox: typeof CheckboxComponent = CheckboxComponent;
export namespace Checkbox {
  export type Props = CheckboxProps;
  export type Emits = CheckboxEmits;
  export type State = CheckboxState;
  export type ChangeEventReason = CheckboxChangeEventReason;
  export type ChangeEventDetails = CheckboxChangeEventDetails;
}

export type {
  CheckboxChangeEventDetails,
  CheckboxChangeEventReason,
  CheckboxEmits,
  CheckboxProps,
  CheckboxState,
};
