import SwitchComponent from './Switch.vue';
import type {
  SwitchChangeEventDetails,
  SwitchChangeEventReason,
  SwitchProps,
  SwitchState,
} from './types';

/**
 * A control that the user can set to on or off.
 * Renders an `<input>` element with the type `checkbox` and the role `switch`.
 */
export const Switch: typeof SwitchComponent = SwitchComponent;
export namespace Switch {
  export type Props = SwitchProps;
  export type State = SwitchState;
  export type ChangeEventReason = SwitchChangeEventReason;
  export type ChangeEventDetails = SwitchChangeEventDetails;
}

export type { SwitchChangeEventDetails, SwitchChangeEventReason, SwitchProps, SwitchState };
