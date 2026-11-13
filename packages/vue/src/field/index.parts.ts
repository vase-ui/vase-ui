import FieldControl from './control/FieldControl.vue';
import type {
  FieldControlChangeEventDetails,
  FieldControlChangeEventReason,
  FieldControlProps,
  FieldControlState,
} from './control/FieldControl.vue';
import FieldRoot from './root/FieldRoot.vue';
import type {
  FieldRootActions,
  FieldRootProps,
  FieldRootState,
  FieldValidityData,
} from './root/FieldRoot.vue';

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 */
export const Root: typeof FieldRoot = FieldRoot;
export namespace Root {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
  export type Actions = FieldRootActions;
}

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Vase UI input component instead. For example,
 * Input, Checkbox or Select, among others, will work with Field out of the box.
 */
export const Control: typeof FieldControl = FieldControl;
export namespace Control {
  export type Props = FieldControlProps;
  export type State = FieldControlState;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}

export type ValidityData = FieldValidityData;
