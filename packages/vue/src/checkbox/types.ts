import type { InputHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface CheckboxProps extends /* @vue-ignore */ Omit<
  InputHTMLAttributes,
  | 'autocomplete'
  | 'checked'
  | 'disabled'
  | 'id'
  | 'indeterminate'
  | 'name'
  | 'readonly'
  | 'required'
  | 'type'
  | 'value'
> {
  modelValue?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  name?: string;
  /** The value in the data of a form. In a group, the value that the group lists. */
  value?: string;
  /**
   * The value in the data of a form while the checkbox is unchecked. A checkbox in a group and the
   * parent checkbox ignore it.
   */
  uncheckedValue?: string;
  id?: string;
  /** The checkbox is the parent checkbox of its group. */
  parent?: boolean;
}

export interface CheckboxState extends FieldState {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

export type CheckboxChangeEventReason = 'none';
export type CheckboxChangeEventDetails = ChangeEventDetails<CheckboxChangeEventReason>;
