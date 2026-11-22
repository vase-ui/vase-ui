import type { InputHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

export interface SwitchProps extends /* @vue-ignore */ Omit<
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
> {
  /**
   * The switch is on. Bind it with `v-model`. With no `modelValue`, the switch keeps its own state.
   */
  modelValue?: boolean;
  /**
   * The switch is on at the mount and at a native reset of the form, when it has no `modelValue`.
   * @default false
   */
  defaultChecked?: boolean;
  /**
   * Disables the switch. A disabled field or fieldset around the switch also disables it.
   * @default false
   */
  disabled?: boolean;
  /**
   * The user cannot change the state. The switch stays in the tab order and is not validated.
   * @default false
   */
  readonly?: boolean;
  /**
   * The user must set the switch to on before a submit of the form.
   * @default false
   */
  required?: boolean;
  /** The `id` of the switch. With no `id`, the switch has an id of its own. */
  id?: string;
  /**
   * The name of the switch in the data of the form. The `name` of a `Field.Root` around it wins.
   */
  name?: string;
  /**
   * The value in the data of a form while the switch is off. The form gets it after the mount, from
   * an enabled switch that has a name.
   */
  uncheckedValue?: string;
}

export interface SwitchEmits {
  /**
   * The user presses the switch. `details.event` is the native `click` event of the press.
   * `details.cancel()` keeps the state as it was.
   */
  checkedChange: [checked: boolean, details: SwitchChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [checked: boolean];
}

export interface SwitchState extends FieldState {
  checked: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

export type SwitchChangeEventReason = 'none';
export type SwitchChangeEventDetails = ChangeEventDetails<SwitchChangeEventReason>;
