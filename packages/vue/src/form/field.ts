import type { InjectionKey } from 'vue';

export type FormValidationMode = 'submit' | 'blur' | 'change';

/** Errors by the name of a field. */
export type FormErrors = Record<string, string | string[]>;

/** What a field gives to its form. */
export interface FormField {
  readonly name: string | undefined;
  /** The element that gets the focus when the form finds the field invalid. */
  readonly element: HTMLElement | undefined;
  /** Validates the field at once. It does not wait for an async `validate`. */
  validate(): void;
  readonly invalid: boolean;
}

/** What a form gives to its fields. The properties are reactive. */
export interface FormForField {
  readonly validationMode: FormValidationMode;
  /** The form had a submit, also a blocked one, since its mount or its last native reset. */
  readonly submitted: boolean;
  readonly errors: Readonly<FormErrors> | undefined;
  /**
   * Makes `control` the control of `field`. The form finds its fields through the controls that
   * the browser lists in `form.elements`.
   */
  addControl(control: Element, field: FormField): void;
  /** The user changed the value of a field. */
  onEdit(name: string | undefined): void;
}

export const formKey: InjectionKey<FormForField> = Symbol('form');
