import type { InputHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type InputAttributes = Omit<
  InputHTMLAttributes,
  'autocomplete' | 'defaultValue' | 'disabled' | 'id' | 'name' | 'readonly' | 'value'
> & { autocomplete?: string | null | undefined };

export interface InputProps extends /* @vue-ignore */ InputAttributes {
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
