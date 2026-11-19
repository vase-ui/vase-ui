import type { ValidationMode } from '../form/field';
import type { FieldState } from './control';

export type FieldValidateResult = string | string[] | null | undefined | void;

export interface FieldRootProps {
  name?: string;
  disabled?: boolean;
  validate?: (value: unknown) => FieldValidateResult | Promise<FieldValidateResult>;
  validationMode?: ValidationMode;
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

export interface FieldLabelProps {
  id?: string;
}

export interface FieldDescriptionProps {
  id?: string;
}

export interface FieldErrorProps {
  id?: string;
  match?: Exclude<keyof FieldValidity, 'valid'>;
}
