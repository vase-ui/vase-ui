import FormComponent from './Form.vue';
import type { FormErrors, FormValidationMode, FormValues } from './field';
import type { FormEmits, FormProps } from './types';

/**
 * A native form element that validates its fields and gives each field its errors. The form has
 * `novalidate`, and a blocked submit moves the focus to the first invalid control.
 * Renders a `<form>` element.
 */
export const Form: typeof FormComponent = FormComponent;
export namespace Form {
  export type Props = FormProps;
  export type Emits<Values extends Record<string, any> = Record<string, any>> = FormEmits<Values>;
  export type Errors = FormErrors;
  export type ValidationMode = FormValidationMode;
  export type Values = FormValues;
}

export type { FormEmits, FormErrors, FormProps, FormValidationMode, FormValues };
