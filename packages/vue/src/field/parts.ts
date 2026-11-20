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
 * Groups all parts of the field and its control, such as an `Input`, a `Checkbox` or a
 * `RadioGroup`.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-valid]` The field is valid.
 * @selector `[data-invalid]` The field is invalid.
 * @selector `[data-touched]` The focus left the control.
 * @selector `[data-dirty]` The value differs from the first value.
 * @selector `[data-filled]` The control has a value.
 */
export const Root: typeof FieldRoot = FieldRoot;
export namespace Root {
  export type Props = FieldRootProps;
  export type State = FieldRootState;
}

/**
 * An accessible label of the control of the field. A `<label>` names a native control with `for`.
 * Another element, and the label of a group such as a `RadioGroup`, name the control with
 * `aria-labelledby`. A click on such a label moves the focus to the control.
 * Renders a `<label>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-valid]` The field is valid.
 * @selector `[data-invalid]` The field is invalid.
 * @selector `[data-touched]` The focus left the control.
 * @selector `[data-dirty]` The value differs from the first value.
 * @selector `[data-filled]` The control has a value.
 */
export const Label: typeof FieldLabel = FieldLabel;
export namespace Label {
  export type Props = FieldLabelProps;
  export type State = FieldLabelState;
}

/**
 * A paragraph with more information about the field. The control names it in `aria-describedby`.
 * Renders a `<p>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-valid]` The field is valid.
 * @selector `[data-invalid]` The field is invalid.
 * @selector `[data-touched]` The focus left the control.
 * @selector `[data-dirty]` The value differs from the first value.
 * @selector `[data-filled]` The control has a value.
 */
export const Description: typeof FieldDescription = FieldDescription;
export namespace Description {
  export type Props = FieldDescriptionProps;
  export type State = FieldDescriptionState;
}

/**
 * An error message that shows while the field is invalid. The control names it in
 * `aria-describedby` while it shows.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The field is disabled.
 * @selector `[data-valid]` The field is valid.
 * @selector `[data-invalid]` The field is invalid.
 * @selector `[data-touched]` The focus left the control.
 * @selector `[data-dirty]` The value differs from the first value.
 * @selector `[data-filled]` The control has a value.
 */
export const Error: typeof FieldError = FieldError;
export namespace Error {
  export type Props = FieldErrorProps;
  export type State = FieldErrorState;
}

/**
 * Groups an item of a checkbox group or a radio group with its label and description. A
 * `Field.Label` in the item labels the control of the item, and a `Field.Description` describes
 * it.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The item is disabled.
 * @selector `[data-valid]` The field is valid.
 * @selector `[data-invalid]` The field is invalid.
 * @selector `[data-touched]` The focus left the control.
 * @selector `[data-dirty]` The value differs from the first value.
 * @selector `[data-filled]` The control has a value.
 */
export const Item: typeof FieldItem = FieldItem;
export namespace Item {
  export type Props = FieldItemProps;
  export type State = FieldItemState;
}
