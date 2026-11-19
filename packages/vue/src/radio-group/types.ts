import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface RadioGroupProps<Value = any> extends /* @vue-ignore */ HTMLAttributes {
  modelValue?: Value;
  defaultValue?: Value;
  name?: string;
  /** The `id` of the form that owns the radios, for a group outside that form. */
  form?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
}

export interface RadioGroupState extends FieldState {
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

export type RadioGroupChangeEventReason = 'none';
export type RadioGroupChangeEventDetails = ChangeEventDetails<RadioGroupChangeEventReason>;
