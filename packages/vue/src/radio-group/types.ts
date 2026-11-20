import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';
import type { AsProps } from '../common/element';

export interface RadioGroupProps<Value = any>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The value of the selected radio. Bind it with `v-model`. With no `modelValue`, the group keeps
   * its own value.
   */
  modelValue?: Value;
  /** The value at the mount of a group that has no `modelValue`. */
  defaultValue?: Value;
  /**
   * The name of the radios in the data of the form. The `name` of a `Field.Root` around the group
   * wins.
   */
  name?: string;
  /** The `id` of the form that owns the radios, for a group outside that form. */
  form?: string;
  /**
   * Disables the group and each radio in it.
   * @default false
   */
  disabled?: boolean;
  /**
   * The user cannot change the value. The arrow keys move the focus and select no radio, and the
   * group is not validated.
   * @default false
   */
  readonly?: boolean;
  /**
   * The user must select a radio before a submit of the form.
   * @default false
   */
  required?: boolean;
}

export interface RadioGroupState extends FieldState {
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

export type RadioGroupChangeEventReason = 'none';
export type RadioGroupChangeEventDetails = ChangeEventDetails<RadioGroupChangeEventReason>;
