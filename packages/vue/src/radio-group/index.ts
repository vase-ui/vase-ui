import RadioGroupComponent from './RadioGroup.vue';
import type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupProps,
  RadioGroupState,
} from './types';

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 */
export const RadioGroup: typeof RadioGroupComponent = RadioGroupComponent;
export namespace RadioGroup {
  export type Props<Value = any> = RadioGroupProps<Value>;
  export type State = RadioGroupState;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}

export type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupProps,
  RadioGroupState,
};
