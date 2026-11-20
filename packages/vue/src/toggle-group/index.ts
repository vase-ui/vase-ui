import ToggleGroupComponent from './ToggleGroup.vue';
import type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupProps,
  ToggleGroupState,
} from './types';

/**
 * Provides a shared state to a series of toggle buttons.
 * Renders a `<div>` element.
 */
export const ToggleGroup: typeof ToggleGroupComponent = ToggleGroupComponent;
export namespace ToggleGroup {
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type State = ToggleGroupState;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}

export type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupProps,
  ToggleGroupState,
};
