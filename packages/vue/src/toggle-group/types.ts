import type { Component, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';

export interface ToggleGroupProps<
  Value extends string = string,
> extends /* @vue-ignore */ HTMLAttributes {
  /**
   * A tag or a component that the part renders in place of its `<div>`, with the same attributes
   * and content. The `element` slot wins over it.
   */
  as?: keyof HTMLElementTagNameMap | Component;
  /**
   * The values of the pressed toggles. With no value, the group owns its value. `null` is an empty
   * value, and the group stays controlled.
   */
  modelValue?: readonly Value[] | null;
  /** The first value of a group that owns its value. `null` is an empty value. */
  defaultValue?: readonly Value[] | null;
  /**
   * More than one toggle can be pressed.
   * @default false
   */
  multiple?: boolean;
  /**
   * The user cannot press a toggle of the group.
   * @default false
   */
  disabled?: boolean;
  /**
   * The axis of the arrow keys.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * The arrow keys move the focus from the last toggle to the first, and from the first to the
   * last.
   * @default true
   */
  loopFocus?: boolean;
}

export interface ToggleGroupState {
  /** By the `disabled` prop, a toolbar, a `Toolbar.Group`, or a disabled fieldset. */
  disabled: boolean;
  /** More than one toggle can be pressed. */
  multiple: boolean;
  /** The axis of the arrow keys. */
  orientation: 'horizontal' | 'vertical';
}

export type ToggleGroupChangeEventReason = 'none';
export type ToggleGroupChangeEventDetails = ChangeEventDetails<ToggleGroupChangeEventReason>;
