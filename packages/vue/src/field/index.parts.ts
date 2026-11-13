import FieldControl from './control/FieldControl.vue';
import type {
  FieldControlChangeEventDetails,
  FieldControlChangeEventReason,
  FieldControlProps,
  FieldControlState,
} from './control/FieldControl.vue';
import FieldError from './error/FieldError.vue';
import type { FieldErrorProps, FieldErrorState } from './error/FieldError.vue';
import FieldRoot from './root/FieldRoot.vue';
import type {
  FieldRootActions,
  FieldRootProps,
  FieldRootState,
  FieldValidityData,
} from './root/FieldRoot.vue';
import FieldValidity from './validity/FieldValidity.vue';
import type { FieldValidityProps, FieldValidityState } from './validity/FieldValidity.vue';

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
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 */
export const Error: typeof FieldError = FieldError;
export namespace Error {
  export type Props = FieldErrorProps;
  export type State = FieldErrorState;
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

/**
 * Used to display a custom message based on the field's validity.
 * Requires a default slot that accepts the field validity state as its slot props.
 */
export const Validity: typeof FieldValidity = FieldValidity;
export namespace Validity {
  export type Props = FieldValidityProps;
  export type State = FieldValidityState;
}

export type ValidityData = FieldValidityData;
