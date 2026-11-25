import type { ButtonHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';

export interface ToggleProps<Value extends string = string>
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled' | 'value'> {
  /** The pressed state. With no value, the toggle owns its state. */
  modelValue?: boolean;
  /**
   * The first pressed state of a toggle that owns its state.
   * @default false
   */
  defaultPressed?: boolean;
  /**
   * The user cannot press the toggle.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled toggle stays in the tab order, and a focused toggle keeps the focus. A disabled
   * fieldset still disables a native button.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
  /**
   * The value of the toggle in a `ToggleGroup`. Give it when the group has `v-model` or
   * `defaultValue`. With none, the toggle has a value of its own.
   */
  value?: Value;
}

export interface ToggleEmits {
  /** The user presses the toggle. `details.cancel()` keeps the state as it was. */
  pressedChange: [pressed: boolean, details: ToggleChangeEventDetails];
  /** Comes after the change event with the new state, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [pressed: boolean];
}

export interface ToggleState {
  /** The toggle is pressed. */
  pressed: boolean;
  /** By the `disabled` prop, by the group, or by a disabled fieldset around a native button. */
  disabled: boolean;
}

export type ToggleChangeEventReason = 'none';
export type ToggleChangeEventDetails = ChangeEventDetails<ToggleChangeEventReason>;
