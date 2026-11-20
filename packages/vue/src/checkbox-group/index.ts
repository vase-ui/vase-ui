import CheckboxGroupComponent from './CheckboxGroup.vue';
import type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupChangeEventReason,
  CheckboxGroupProps,
  CheckboxGroupState,
} from './types';

/**
 * Holds the shared state of a series of checkboxes.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The group is disabled.
 * @selector `[data-valid]` The field of the group is valid.
 * @selector `[data-invalid]` The field of the group is invalid.
 * @selector `[data-touched]` In a field, the focus left the group.
 * @selector `[data-dirty]` In a field, the value differs from the first value.
 * @selector `[data-filled]` In a field, the value is not empty.
 */
export const CheckboxGroup: typeof CheckboxGroupComponent = CheckboxGroupComponent;
export namespace CheckboxGroup {
  export type Props = CheckboxGroupProps;
  export type State = CheckboxGroupState;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}

export type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupChangeEventReason,
  CheckboxGroupProps,
  CheckboxGroupState,
};
