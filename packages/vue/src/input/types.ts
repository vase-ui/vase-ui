import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface InputProps {
  modelValue?: string | number | readonly string[];
  defaultValue?: string | number | string[];
  id?: string;
  name?: string;
  disabled?: boolean;
  readonly?: boolean;
}

export interface InputState extends FieldState {
  disabled: boolean;
}

export type InputChangeEventReason = 'none';

export type InputChangeEventDetails = ChangeEventDetails<InputChangeEventReason>;
