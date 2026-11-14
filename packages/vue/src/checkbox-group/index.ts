import CheckboxGroupComponent from './CheckboxGroup.vue';
import type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupChangeEventReason,
  CheckboxGroupProps,
  CheckboxGroupState,
} from './CheckboxGroup.vue';

/**
 * Provides a shared state to a series of checkboxes.
 * Renders a `<div>` element.
 */
export const CheckboxGroup: typeof CheckboxGroupComponent = CheckboxGroupComponent;
export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props = CheckboxGroupProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}

export type * from './CheckboxGroup.vue';

export * as CheckboxGroupDataAttributes from './CheckboxGroupDataAttributes';
