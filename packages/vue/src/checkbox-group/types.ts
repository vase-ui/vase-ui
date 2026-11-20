import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';
import type { AsProps } from '../common/element';

export interface CheckboxGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The values of the checked checkboxes. Bind it with `v-model`. A press adds the value of the
   * checkbox at the end, or removes it. `null` is an empty value. With no `modelValue`, the group
   * keeps its own value.
   */
  modelValue?: string[] | null;
  /** The value at the mount of a group that has no `modelValue`. */
  defaultValue?: string[] | null;
  /** The values of all the checkboxes that the parent checkbox controls. */
  allValues?: string[];
  /**
   * Disables the group and each checkbox in it.
   * @default false
   */
  disabled?: boolean;
}

export interface CheckboxGroupState extends FieldState {
  disabled: boolean;
}

export type CheckboxGroupChangeEventReason = 'none';
export type CheckboxGroupChangeEventDetails = ChangeEventDetails<CheckboxGroupChangeEventReason>;
