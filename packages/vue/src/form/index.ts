import FormComponent from './Form.vue';
import type {
  FormActions,
  FormProps,
  FormState,
  FormSubmitEventDetails,
  FormSubmitEventReason,
  FormValidationMode,
} from './Form.vue';

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 */
export const Form: typeof FormComponent = FormComponent;
export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> =
    FormProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}

export type * from './Form.vue';
