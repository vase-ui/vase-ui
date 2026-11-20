import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Component, HTMLAttributes } from 'vue';
import type { InputProps } from '../input';
import type { SeparatorProps, SeparatorState } from '../separator';

export type ToolbarOrientation = 'horizontal' | 'vertical';

interface ToolbarAs {
  /**
   * A tag or a component that the part renders in place of its element, with the same attributes
   * and content. The `element` slot wins over it.
   */
  as?: keyof HTMLElementTagNameMap | Component;
}

export interface ToolbarRootProps extends ToolbarAs, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
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

export interface ToolbarGroupProps extends ToolbarAs, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
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
  extends ToolbarAs, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /**
   * The user cannot press the button.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled button stays in the arrow keys of the toolbar, and keeps the focus.
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
  'disabled' | 'readonly'
> {
  /**
   * The user cannot edit the input.
   * @default false
   */
  disabled?: boolean;
  /**
   * A disabled input stays in the arrow keys of the toolbar, and keeps the focus. It is read-only.
   * @default true
   */
  focusableWhenDisabled?: boolean;
  /** The text of the input. With no value, the input owns its text. */
  modelValue?: InputProps['modelValue'];
  /** The first text of an input that owns its text. */
  defaultValue?: InputProps['defaultValue'];
  id?: string;
  name?: string;
  readonly?: boolean;
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
  extends ToolbarAs, /* @vue-ignore */ Omit<AnchorHTMLAttributes, 'as'> {}

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
