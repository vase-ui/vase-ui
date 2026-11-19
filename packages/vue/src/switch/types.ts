import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface SwitchProps {
  modelValue?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  id?: string;
  name?: string;
}

export interface SwitchState extends FieldState {
  checked: boolean;
  disabled: boolean;
  readonly: boolean;
}

export type SwitchChangeEventReason = 'none';
export type SwitchChangeEventDetails = ChangeEventDetails<SwitchChangeEventReason>;
