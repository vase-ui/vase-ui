import FormComponent from './Form.vue';
import type { FormErrors, FormValidationMode, FormValues } from './field';
import type { FormProps } from './types';

export const Form: typeof FormComponent = FormComponent;
export namespace Form {
  export type Props = FormProps;
  export type Errors = FormErrors;
  export type ValidationMode = FormValidationMode;
  export type Values = FormValues;
}

export type { FormErrors, FormProps, FormValidationMode, FormValues };
