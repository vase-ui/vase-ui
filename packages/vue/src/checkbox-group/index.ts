import CheckboxGroupComponent from './CheckboxGroup.vue';
import type {
  CheckboxGroupChangeEventDetails,
  CheckboxGroupChangeEventReason,
  CheckboxGroupProps,
  CheckboxGroupState,
} from './types';

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
