import type { ButtonHTMLAttributes } from 'vue';

export interface ButtonProps extends /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled button stays in the tab order, and a focused button keeps the focus.
   * @default false
   */
  focusableWhenDisabled?: boolean;
}

export interface ButtonState {
  /** By the `disabled` prop, or by a disabled fieldset around a native button. */
  disabled: boolean;
}
