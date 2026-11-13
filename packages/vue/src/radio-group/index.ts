import RadioGroupComponent from './RadioGroup.vue';
import type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupProps,
  RadioGroupState,
} from './RadioGroup.vue';

/**
 * Provides shared state to a series of radio buttons.
 * Renders a `<div>` element.
 */
export const RadioGroup: typeof RadioGroupComponent = RadioGroupComponent;
export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<Value = any> = RadioGroupProps<Value>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}

export type * from './RadioGroup.vue';

export * as RadioGroupDataAttributes from './RadioGroupDataAttributes';
