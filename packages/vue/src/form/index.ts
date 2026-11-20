import FormComponent from './Form.vue';
import type { FormErrors, FormValidationMode, FormValues } from './field';
import type { FormProps } from './types';

/**
 * A native form element that validates its fields and gives each field its errors. The form has
 * `novalidate`, and a blocked submit moves the focus to the first invalid control.
 * Renders a `<form>` element.
 */
export const Form: typeof FormComponent = FormComponent;
export namespace Form {
  export type Props = FormProps;
  export type Errors = FormErrors;
  export type ValidationMode = FormValidationMode;
  export type Values = FormValues;
}

export type { FormErrors, FormProps, FormValidationMode, FormValues };
