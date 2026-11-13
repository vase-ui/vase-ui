import FieldControl from './control/FieldControl.vue';
import type {
  FieldControlChangeEventDetails,
  FieldControlChangeEventReason,
  FieldControlProps,
  FieldControlState,
} from './control/FieldControl.vue';
import FieldDescription from './description/FieldDescription.vue';
import type {
  FieldDescriptionProps,
  FieldDescriptionState,
} from './description/FieldDescription.vue';
import FieldError from './error/FieldError.vue';
import type { FieldErrorProps, FieldErrorState } from './error/FieldError.vue';
import FieldItem from './item/FieldItem.vue';
import type { FieldItemProps, FieldItemState } from './item/FieldItem.vue';
import FieldLabel from './label/FieldLabel.vue';
import type { FieldLabelProps, FieldLabelState } from './label/FieldLabel.vue';
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
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 */
export const Label: typeof FieldLabel = FieldLabel;
export namespace Label {
  export type Props = FieldLabelProps;
  export type State = FieldLabelState;
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
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 */
export const Description: typeof FieldDescription = FieldDescription;
export namespace Description {
  export type Props = FieldDescriptionProps;
  export type State = FieldDescriptionState;
}

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Vase UI input component instead. For example,
 * Input, Checkbox or Switch, among others, will work with Field out of the box.
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

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 */
export const Item: typeof FieldItem = FieldItem;
export namespace Item {
  export type Props = FieldItemProps;
  export type State = FieldItemState;
}

export type ValidityData = FieldValidityData;
