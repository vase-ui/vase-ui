import ToggleGroupComponent from './ToggleGroup.vue';
import type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupEmits,
  ToggleGroupProps,
  ToggleGroupState,
} from './types';

/**
 * Provides a shared state to a series of toggle buttons.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the group: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The group is disabled by its prop, a toolbar or a fieldset.
 */
export const ToggleGroup: typeof ToggleGroupComponent = ToggleGroupComponent;
export namespace ToggleGroup {
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type Emits<Value extends string = string> = ToggleGroupEmits<Value>;
  export type State = ToggleGroupState;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}

export type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupEmits,
  ToggleGroupProps,
  ToggleGroupState,
};
