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
   * The moments when the fields of the form validate. With `'submit'`, a field validates at each
   * submit, and at each change after the first submit. With `'blur'`, it validates when the focus
   * leaves its control. With `'change'`, it validates at each change. The `validationMode` of a
   * `Field.Root` wins.
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

export interface FormEmits<Values extends Record<string, any> = Record<string, any>> {
  /**
   * A submit with each field valid. `values` has the value of each named field of the form that is
   * not disabled. The form prevents the native submit while it has a `submit` listener. With no
   * listener, the browser submits the form. Give `@submit` a function, because the form can miss a
   * listener that you add or remove after the mount.
   */
  submit: [event: SubmitEvent, values: Values];
  /** An edit or a reset removes the errors of a field. `v-model:errors` uses it. */
  'update:errors': [errors: FormErrors];
}
