import ToggleComponent from './Toggle.vue';
import type {
  ToggleChangeEventDetails,
  ToggleChangeEventReason,
  ToggleProps,
  ToggleState,
} from './Toggle.vue';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 */
export const Toggle: typeof ToggleComponent = ToggleComponent;
export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}

export type * from './Toggle.vue';

export * as ToggleDataAttributes from './ToggleDataAttributes';
