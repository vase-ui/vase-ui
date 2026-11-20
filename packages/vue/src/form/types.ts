import type { FormHTMLAttributes } from 'vue';
import type { FormErrors, FormValidationMode } from './field';

type FormSubmitListener<Values> = (event: SubmitEvent, values: Values) => void;

export interface FormProps<
  Values extends Record<string, any> = Record<string, any>,
> extends /* @vue-ignore */ Omit<FormHTMLAttributes, 'onSubmit'> {
  /** Errors from outside the form, by the name of each field. `v-model:errors` uses it. */
  errors?: FormErrors;
  validationMode?: FormValidationMode;
  /**
   * The `submit` listener. The form reads it to prevent the native submit.
   * @ignore
   */
  onSubmit?: FormSubmitListener<Values> | FormSubmitListener<Values>[];
  /**
   * The `submit` listener with the `.once` modifier. The form reads it to prevent the native submit.
   * @ignore
   */
  onSubmitOnce?: FormSubmitListener<Values> | FormSubmitListener<Values>[];
}
