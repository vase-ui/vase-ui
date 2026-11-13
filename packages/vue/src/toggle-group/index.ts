import ToggleGroupComponent from './ToggleGroup.vue';
import type {
  ToggleGroupChangeEventDetails,
  ToggleGroupChangeEventReason,
  ToggleGroupProps,
  ToggleGroupState,
} from './ToggleGroup.vue';

/**
 * Provides a shared state to a series of toggle buttons.
 */
export const ToggleGroup: typeof ToggleGroupComponent = ToggleGroupComponent;
export namespace ToggleGroup {
  export type State = ToggleGroupState;
  export type Props<Value extends string = string> = ToggleGroupProps<Value>;
  export type ChangeEventReason = ToggleGroupChangeEventReason;
  export type ChangeEventDetails = ToggleGroupChangeEventDetails;
}

export type * from './ToggleGroup.vue';

export * as ToggleGroupDataAttributes from './ToggleGroupDataAttributes';
