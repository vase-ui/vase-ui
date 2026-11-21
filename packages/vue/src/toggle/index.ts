import ToggleComponent from './Toggle.vue';
import type {
  ToggleChangeEventDetails,
  ToggleChangeEventReason,
  ToggleEmits,
  ToggleProps,
  ToggleState,
} from './types';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 * @selector `[aria-pressed="true"]` The toggle is pressed.
 * @selector `:disabled` The toggle is disabled, and it is a native button.
 * @selector `[aria-disabled="true"]` The toggle is disabled, and it is not a native button, or a `Toolbar.Button` keeps it in the tab order.
 */
export const Toggle: typeof ToggleComponent = ToggleComponent;
export namespace Toggle {
  export type Props<Value extends string = string> = ToggleProps<Value>;
  export type Emits = ToggleEmits;
  export type State = ToggleState;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}

export type {
  ToggleChangeEventDetails,
  ToggleChangeEventReason,
  ToggleEmits,
  ToggleProps,
  ToggleState,
};
