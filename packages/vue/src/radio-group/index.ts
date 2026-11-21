import RadioGroupComponent from './RadioGroup.vue';
import type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupEmits,
  RadioGroupProps,
  RadioGroupState,
} from './types';

/**
 * Holds the shared state of a series of radio buttons.
 * Renders a `<div>` element.
 * @selector `[aria-disabled="true"]` The group is disabled.
 * @selector `[aria-readonly="true"]` The group is read-only.
 * @selector `[aria-required="true"]` The group or one of its radios is required.
 * @selector `[data-valid]` The field of the group is valid.
 * @selector `[aria-invalid="true"]` The field of the group is invalid.
 * @selector `[data-touched]` In a field, the focus left the group.
 * @selector `[data-dirty]` In a field, the value differs from the first value.
 * @selector `[data-filled]` In a field, the group has a value.
 */
export const RadioGroup: typeof RadioGroupComponent = RadioGroupComponent;
export namespace RadioGroup {
  export type Props<Value = any> = RadioGroupProps<Value>;
  export type Emits<Value = any> = RadioGroupEmits<Value>;
  export type State = RadioGroupState;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}

export type {
  RadioGroupChangeEventDetails,
  RadioGroupChangeEventReason,
  RadioGroupEmits,
  RadioGroupProps,
  RadioGroupState,
};
