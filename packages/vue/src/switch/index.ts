import SwitchComponent from './Switch.vue';
import type {
  SwitchChangeEventDetails,
  SwitchChangeEventReason,
  SwitchProps,
  SwitchState,
} from './types';

export const Switch: typeof SwitchComponent = SwitchComponent;
export namespace Switch {
  export type Props = SwitchProps;
  export type State = SwitchState;
  export type ChangeEventReason = SwitchChangeEventReason;
  export type ChangeEventDetails = SwitchChangeEventDetails;
}

export type { SwitchChangeEventDetails, SwitchChangeEventReason, SwitchProps, SwitchState };
