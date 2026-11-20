import type { ButtonHTMLAttributes, Component } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';

export interface ToggleProps<Value extends string = string> extends /* @vue-ignore */ Omit<
  ButtonHTMLAttributes,
  'disabled' | 'value'
> {
  /**
   * A tag or a component that the part renders in place of its `<button>`, with the same
   * attributes and content. The `element` slot wins over it.
   */
  as?: keyof HTMLElementTagNameMap | Component;
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
  /** The value of the toggle in a `ToggleGroup`. */
  value?: Value;
}

export interface ToggleState {
  /** The toggle is pressed. */
  pressed: boolean;
  /** By the `disabled` prop, by the group, or by a disabled fieldset around a native button. */
  disabled: boolean;
}

export type ToggleChangeEventReason = 'none';
export type ToggleChangeEventDetails = ChangeEventDetails<ToggleChangeEventReason>;
