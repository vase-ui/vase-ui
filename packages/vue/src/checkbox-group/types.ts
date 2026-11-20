import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';
import type { AsProps } from '../common/element';

export interface CheckboxGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** `null` is an empty value. */
  modelValue?: string[] | null;
  defaultValue?: string[] | null;
  /** The values of all the checkboxes that the parent checkbox controls. */
  allValues?: string[];
  disabled?: boolean;
}

export interface CheckboxGroupState extends FieldState {
  disabled: boolean;
}

export type CheckboxGroupChangeEventReason = 'none';
export type CheckboxGroupChangeEventDetails = ChangeEventDetails<CheckboxGroupChangeEventReason>;
