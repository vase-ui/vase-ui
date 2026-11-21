import type { HTMLAttributes, LabelHTMLAttributes } from 'vue';
import type { FormValidationMode, FormValues } from '../form/field';
import type { FieldState } from './control';
import type { AsProps } from '../common/element';

export type FieldValidateResult = string | string[] | null | undefined | void;

export interface FieldRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The name of the field in the data and the values of the form. It wins over the `name` of the
   * control.
   */
  name?: string;
  /**
   * Disables the field and its control.
   * @default false
   */
  disabled?: boolean;
  /**
   * Checks the value after the native check passes. Return the error messages: a string or an array
   * of strings. Return nothing, `null`, an empty string or an empty array for a valid value.
   * `formValues` holds the values of the fields of the form, by name, and is empty with no form.
   * The form does not wait for a promise.
   */
  validate?: (
    value: unknown,
    formValues: FormValues,
  ) => FieldValidateResult | Promise<FieldValidateResult>;
  /**
   * The moments when the field validates its control. With `'submit'`, the field validates at each
   * submit of the form, and at each change after the first submit. With `'blur'`, it validates when
   * the focus leaves the control. With `'change'`, it validates at each change. With no
   * `validationMode`, the field takes the mode of its form, or else `'submit'`.
   */
  validationMode?: FormValidationMode;
  /**
   * The time in milliseconds that the field waits after the last change before it validates.
   * @default 0
   */
  validationDebounceTime?: number;
  /**
   * Makes the field invalid, for a check outside the field.
   * @default false
   */
  invalid?: boolean;
  /**
   * The value differs from its value at the mount or at the last native reset of the form. Bind
   * it with `v-model:dirty`. With no `dirty`, the field finds the state itself.
   */
  dirty?: boolean;
  /**
   * The focus left the control one time or more. Bind it with `v-model:touched`. With no `touched`,
   * the field finds the state itself.
   */
  touched?: boolean;
}

export interface FieldRootState extends FieldState {
  disabled: boolean;
}

export type FieldLabelState = FieldRootState;
export type FieldDescriptionState = FieldRootState;
export type FieldErrorState = FieldRootState;
export type FieldItemState = FieldRootState;

/** The keys of the native `ValidityState`, and the `valid` of the state of the field. */
export interface FieldValidity {
  badInput: boolean;
  customError: boolean;
  patternMismatch: boolean;
  rangeOverflow: boolean;
  rangeUnderflow: boolean;
  stepMismatch: boolean;
  tooLong: boolean;
  tooShort: boolean;
  typeMismatch: boolean;
  valueMissing: boolean;
  valid: boolean | null;
}

export interface FieldLabelProps extends /* @vue-ignore */ Omit<LabelHTMLAttributes, 'for' | 'id'> {
  /** The `id` of the label. With no `id`, the label has an id of its own. */
  id?: string;
}

export interface FieldDescriptionProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the description. With no `id`, the description has an id of its own. */
  id?: string;
}

export interface FieldItemProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * Disables the control of the item. A disabled field, group or fieldset also disables it.
   * @default false
   */
  disabled?: boolean;
}

export interface FieldErrorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /** The `id` of the error. With no `id`, the error has an id of its own. */
  id?: string;
  /**
   * Shows the error only while the field has this failure, such as `valueMissing`. A failure of
   * `validate` is `customError`. With no `match`, the error shows while the field is invalid.
   */
  match?: Exclude<keyof FieldValidity, 'valid'>;
}
