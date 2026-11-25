import SwitchComponent from './Switch.vue';
import type {
  SwitchChangeEventDetails,
  SwitchChangeEventReason,
  SwitchEmits,
  SwitchProps,
  SwitchState,
} from './types';

/**
 * A control that the user can set to on or off.
 * Renders an `<input>` element with the type `checkbox` and the role `switch`.
 * @selector `:checked` The switch is on.
 * @selector `:disabled` The switch is disabled and out of the tab order.
 * @selector `[aria-disabled="true"]` The switch is disabled and stays in the tab order. `:enabled` also matches such an input, so select an enabled switch with `:not(:disabled, [aria-disabled="true"])`.
 * @selector `:required` The switch is required, not read-only, and not kept in the tab order while disabled.
 * @selector `[aria-readonly="true"]` The switch is read-only.
 * @selector `[data-valid]` The field of the switch is valid.
 * @selector `[aria-invalid="true"]` The field of the switch is invalid.
 * @selector `[data-touched]` In a field, the focus left the switch.
 * @selector `[data-dirty]` In a field, the value differs from the first value.
 */
export const Switch: typeof SwitchComponent = SwitchComponent;
export namespace Switch {
  export type Props = SwitchProps;
  export type Emits = SwitchEmits;
  export type State = SwitchState;
  export type ChangeEventReason = SwitchChangeEventReason;
  export type ChangeEventDetails = SwitchChangeEventDetails;
}

export type {
  SwitchChangeEventDetails,
  SwitchChangeEventReason,
  SwitchEmits,
  SwitchProps,
  SwitchState,
};
