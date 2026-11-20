import type { InputHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type InputAttributes = Omit<
  InputHTMLAttributes,
  'autocomplete' | 'defaultValue' | 'disabled' | 'id' | 'name' | 'readonly' | 'value'
> & { autocomplete?: string | null | undefined };

export interface InputProps extends /* @vue-ignore */ InputAttributes {
  /**
   * The text of the input. Bind it with `v-model`. With no `modelValue`, the input keeps its own
   * text.
   */
  modelValue?: string | number | readonly string[];
  /**
   * The text at the mount of an input that has no `modelValue`. A native reset of the form gives
   * the input its first text again.
   */
  defaultValue?: string | number | string[];
  /** The `id` of the input. With no `id`, the input has an id of its own. */
  id?: string;
  /** The name of the input in the data of the form. The `name` of a `Field.Root` around it wins. */
  name?: string;
  /**
   * Disables the input. A disabled field or fieldset around the input also disables it.
   * @default false
   */
  disabled?: boolean;
  /**
   * The user cannot change the text. The input stays in the tab order and in the data of the form,
   * and its field does not validate it.
   * @default false
   */
  readonly?: boolean;
}

export interface InputState extends FieldState {
  disabled: boolean;
}

export type InputChangeEventReason = 'none';

export type InputChangeEventDetails = ChangeEventDetails<InputChangeEventReason>;
