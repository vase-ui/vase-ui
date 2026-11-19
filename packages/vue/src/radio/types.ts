import type { FieldState } from '../field/control';

export interface RadioProps<Value = any> {
  /** The value that the group gets when the user selects this radio. */
  value: Value;
  id?: string;
  disabled?: boolean;
  /** The user can reach the radio and cannot select it. */
  readonly?: boolean;
  /** Makes the group required, as `required` on one native radio does. */
  required?: boolean;
}

export interface RadioState extends FieldState {
  checked: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}
