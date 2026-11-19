import type { HTMLAttributes, LabelHTMLAttributes } from 'vue';
import type { FormValidationMode, FormValues } from '../form/field';
import type { FieldState } from './control';

export type FieldValidateResult = string | string[] | null | undefined | void;

export interface FieldRootProps extends /* @vue-ignore */ HTMLAttributes {
  name?: string;
  disabled?: boolean;
  /**
   * Checks the value after the native check passes. `formValues` holds the values of the fields of
   * the form, by name, and is empty with no form.
   */
  validate?: (
    value: unknown,
    formValues: FormValues,
  ) => FieldValidateResult | Promise<FieldValidateResult>;
  validationMode?: FormValidationMode;
  validationDebounceTime?: number;
  invalid?: boolean;
  dirty?: boolean;
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
  id?: string;
}

export interface FieldDescriptionProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  id?: string;
}

export interface FieldItemProps extends /* @vue-ignore */ HTMLAttributes {
  disabled?: boolean;
}

export interface FieldErrorProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  id?: string;
  match?: Exclude<keyof FieldValidity, 'valid'>;
}
