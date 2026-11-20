import type { ButtonHTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export interface ButtonProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled button stays in the tab order, and a focused button keeps the focus. A disabled
   * fieldset still disables a native button.
   * @default false
   */
  focusableWhenDisabled?: boolean;
}

export interface ButtonState {
  /** By the `disabled` prop, or by a disabled fieldset around a native button. */
  disabled: boolean;
}
