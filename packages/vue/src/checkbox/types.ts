import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface CheckboxProps {
  modelValue?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  name?: string;
  /** The value in the data of a form. In a group, the value that the group lists. */
  value?: string;
  id?: string;
  /** The checkbox is the parent checkbox of its group. */
  parent?: boolean;
}

export interface CheckboxState extends FieldState {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  readonly: boolean;
}

export type CheckboxChangeEventReason = 'none';
export type CheckboxChangeEventDetails = ChangeEventDetails<CheckboxChangeEventReason>;
