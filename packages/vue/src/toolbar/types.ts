import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';
import type { InputChangeEventDetails, InputProps } from '../input';
import type { SeparatorProps, SeparatorState } from '../separator';

export type ToolbarOrientation = 'horizontal' | 'vertical';

export interface ToolbarRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The axis of the arrow keys.
   * @default 'horizontal'
   */
  orientation?: ToolbarOrientation;
  /**
   * The user cannot use an item of the toolbar. A link stays enabled.
   * @default false
   */
  disabled?: boolean;
  /**
   * The arrow keys move the focus from the last item to the first, and from the first to the last.
   * @default true
   */
  loopFocus?: boolean;
}

export interface ToolbarRootState {
  /** The toolbar is disabled. */
  disabled: boolean;
  /** The axis of the arrow keys. */
  orientation: ToolbarOrientation;
}

export interface ToolbarGroupProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The user cannot use an item of the group. A link stays enabled.
   * @default false
   */
  disabled?: boolean;
}

export interface ToolbarGroupState {
  /** By the `disabled` prop, or by the toolbar. */
  disabled: boolean;
  /** The orientation of the toolbar. */
  orientation: ToolbarOrientation;
}

export interface ToolbarButtonProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button. The toolbar stops each click, press and key on it. Tab,
   * Escape, F1 to F12 and the keys with Ctrl, Alt or Meta pass. Hover and focus events pass too, so
   * a tooltip can say why the button is disabled.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled button stays in the arrow keys of the toolbar, and keeps the focus. With `false`, the
   * arrow keys pass it.
   * @default true
   */
  focusableWhenDisabled?: boolean;
}

export interface ToolbarButtonState {
  /** By the `disabled` prop, the toolbar, a group, or a disabled fieldset around a native button. */
  disabled: boolean;
  /** The value of `focusableWhenDisabled`. */
  focusable: boolean;
  /** The orientation of the toolbar. */
  orientation: ToolbarOrientation;
}

export interface ToolbarInputProps extends /* @vue-ignore */ Omit<
  InputProps,
  'defaultValue' | 'disabled' | 'id' | 'modelValue' | 'name' | 'readonly'
> {
  /**
   * The user cannot edit the input.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled input stays in the arrow keys of the toolbar, and keeps the focus. It is read-only.
   * With `false`, the arrow keys pass it.
   * @default true
   */
  focusableWhenDisabled?: boolean;
  /** The text of the input. With no value, the input owns its text. */
  modelValue?: NonNullable<InputProps['modelValue']>;
  /** The text of an input that owns its text, at the mount and at a native reset of the form. */
  defaultValue?: NonNullable<InputProps['defaultValue']>;
  /** The id of the input, or of the element of the `element` slot. */
  id?: string;
  /** The name of the input in the form data. */
  name?: string;
  /** The user cannot edit the text. A disabled input that keeps the focus is read-only too. */
  readonly?: boolean;
}

export interface ToolbarInputEmits {
  /** The user changes the text. `details.cancel()` keeps the text as it was. */
  valueChange: [value: string, details: InputChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: string];
}

export interface ToolbarInputState {
  /** By the `disabled` prop, the toolbar or a group. */
  disabled: boolean;
  /** The value of `focusableWhenDisabled`. */
  focusable: boolean;
  /** The orientation of the toolbar. */
  orientation: ToolbarOrientation;
}

export interface ToolbarLinkProps
  extends AsProps, /* @vue-ignore */ Omit<AnchorHTMLAttributes, 'as'> {}

export interface ToolbarLinkState {
  /** The orientation of the toolbar. */
  orientation: ToolbarOrientation;
}

export interface ToolbarSeparatorProps extends SeparatorProps {
  /**
   * The orientation of the separator. With no value, it is across the toolbar: vertical in a
   * horizontal toolbar.
   */
  orientation?: 'horizontal' | 'vertical';
}

export interface ToolbarSeparatorState extends SeparatorState {}
