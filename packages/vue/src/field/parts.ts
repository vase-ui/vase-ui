import FieldDescription from './FieldDescription.vue';
import FieldError from './FieldError.vue';
import FieldItem from './FieldItem.vue';
import FieldLabel from './FieldLabel.vue';
import FieldRoot from './FieldRoot.vue';
import type {
  FieldDescriptionProps,
  FieldDescriptionState,
  FieldErrorProps,
  FieldErrorState,
  FieldItemProps,
  FieldItemState,
  FieldLabelProps,
  FieldLabelState,
  FieldRootProps,
  FieldRootState,
} from './types';

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 */
export const Root: typeof FieldRoot = FieldRoot;
export namespace Root {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
}

/**
 * An accessible label that the field connects to its control.
 * Renders a `<label>` element.
 */
export const Label: typeof FieldLabel = FieldLabel;
export namespace Label {
  export type Props = FieldLabelProps;
  export type State = FieldLabelState;
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
 * An error message that shows when the field control fails validation.
 * Renders a `<div>` element.
 */
export const Error: typeof FieldError = FieldError;
export namespace Error {
  export type Props = FieldErrorProps;
  export type State = FieldErrorState;
}

/**
 * Groups an item of a checkbox group or a radio group with its label and description.
 * Renders a `<div>` element.
 */
export const Item: typeof FieldItem = FieldItem;
export namespace Item {
  export type Props = FieldItemProps;
  export type State = FieldItemState;
}
