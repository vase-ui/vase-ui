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
  /**
   * The checked state. Bind it with `v-model`. With no `modelValue`, the checkbox keeps its own
   * state.
   */
  modelValue?: boolean;
  /**
   * The checked state of a checkbox that has no `modelValue`, at the mount and at a native reset of
   * the form.
   * @default false
   */
  defaultChecked?: boolean;
  /**
   * Shows a state that is neither checked nor unchecked. A press asks to clear it with
   * `update:indeterminate`, so bind it with `v-model:indeterminate`.
   * @default false
   */
  indeterminate?: boolean;
  /**
   * Disables the checkbox. A disabled field, group or fieldset around the checkbox also disables
   * it.
   * @default false
   */
  disabled?: boolean;
  /**
   * The user cannot change the state. The checkbox stays in the tab order and is not validated.
   * @default false
   */
  readonly?: boolean;
  /**
   * The user must check the checkbox before a submit of the form.
   * @default false
   */
  required?: boolean;
  /**
   * The name of the checkbox in the data of the form. The `name` of a `Field.Root` around it wins.
   */
  name?: string;
  /**
   * The value in the data of a form. In a group, the value that the group lists. A checkbox with no
   * `value` keeps its own state in a group.
   */
  value?: string;
  /**
   * The value in the data of a form while the checkbox is unchecked. The form gets it after the
   * mount, from an enabled checkbox that has a name. The parent checkbox and a checkbox with a
   * `value` in a group ignore it.
   */
  uncheckedValue?: string;
  /** The `id` of the checkbox. With no `id`, the checkbox has an id of its own. */
  id?: string;
  /**
   * The checkbox checks and clears each checkbox of the `allValues` of its group, and names them in
   * `aria-controls`. It has no name.
   * @default false
   */
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
