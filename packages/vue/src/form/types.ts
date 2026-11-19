import type { FormErrors, FormValidationMode } from './field';

export interface FormProps {
  /** Errors from outside the form, by the name of each field. `v-model:errors` uses it. */
  errors?: FormErrors;
  validationMode?: FormValidationMode;
}
