import type { FormHTMLAttributes } from 'vue';
import type { FormErrors, FormValidationMode } from './field';

type FormSubmitListener<Values> = (event: SubmitEvent, values: Values) => void;

export interface FormProps<
  Values extends Record<string, any> = Record<string, any>,
> extends /* @vue-ignore */ Omit<FormHTMLAttributes, 'onSubmit'> {
  /**
   * Errors from outside the form, by the name of each field. `v-model:errors` uses it. After a
   * submit that passes, the first change of `errors` moves the focus to the first invalid control.
   */
  errors?: FormErrors;
  /**
   * When the fields of the form validate: `'submit'` at each submit and, after the first submit, at
   * each change; `'blur'` when the focus leaves a control; `'change'` at each change. The
   * `validationMode` of a `Field.Root` wins.
   * @default 'submit'
   */
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
