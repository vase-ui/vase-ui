import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';

export interface ToggleGroupProps<Value extends string = string>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
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
   * The axis of the arrow keys. A group in a toolbar uses the keys of the toolbar.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * The arrow keys move the focus from the last toggle to the first, and from the first to the
   * last. A group in a toolbar uses the `loopFocus` of the toolbar.
   * @default true
   */
  loopFocus?: boolean;
}

export interface ToggleGroupEmits<Value extends string = string> {
  /** The user presses a toggle. `details.cancel()` keeps the value as it was. */
  valueChange: [value: Value[], details: ToggleGroupChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value[]];
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
