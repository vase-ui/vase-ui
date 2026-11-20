import CheckboxComponent from './Checkbox.vue';
import type {
  CheckboxChangeEventDetails,
  CheckboxChangeEventReason,
  CheckboxProps,
  CheckboxState,
} from './types';

/**
 * A box that the user can tick and clear.
 * Renders an `<input>` element with the type `checkbox`.
 */
export const Checkbox: typeof CheckboxComponent = CheckboxComponent;
export namespace Checkbox {
  export type Props = CheckboxProps;
  export type State = CheckboxState;
  export type ChangeEventReason = CheckboxChangeEventReason;
  export type ChangeEventDetails = CheckboxChangeEventDetails;
}

export type { CheckboxChangeEventDetails, CheckboxChangeEventReason, CheckboxProps, CheckboxState };
