import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface SwitchProps {
  modelValue?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  /** The value in the data of a form while the switch is unchecked. */
  uncheckedValue?: string;
}

export interface SwitchState extends FieldState {
  checked: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

export type SwitchChangeEventReason = 'none';
export type SwitchChangeEventDetails = ChangeEventDetails<SwitchChangeEventReason>;
