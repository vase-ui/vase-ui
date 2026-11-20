import ToggleComponent from './Toggle.vue';
import type {
  ToggleChangeEventDetails,
  ToggleChangeEventReason,
  ToggleProps,
  ToggleState,
} from './types';

export const Toggle: typeof ToggleComponent = ToggleComponent;
export namespace Toggle {
  export type Props<Value extends string = string> = ToggleProps<Value>;
  export type State = ToggleState;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}

export type { ToggleChangeEventDetails, ToggleChangeEventReason, ToggleProps, ToggleState };
