import type { FormHTMLAttributes } from 'vue';
import type { FormErrors, FormValidationMode } from './field';

export interface FormProps extends /* @vue-ignore */ Omit<FormHTMLAttributes, 'onSubmit'> {
  /** Errors from outside the form, by the name of each field. `v-model:errors` uses it. */
  errors?: FormErrors;
  validationMode?: FormValidationMode;
}
