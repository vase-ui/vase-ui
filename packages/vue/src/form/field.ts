import type { InjectionKey } from 'vue';

export type FormValidationMode = 'submit' | 'blur' | 'change';

/** Errors by the name of a field. */
export type FormErrors = Record<string, string | string[]>;

/** What a field in a form gives to the form, from its mount to its unmount. */
export interface FormField {
  readonly name: string | undefined;
  /**
   * The element of the control. Its `form` tells if the field counts for the form. The form also
   * uses it for the focus and the order of the document.
   */
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
  /** Adds a field to the form. Returns the function that removes it. */
  addField(field: FormField): () => void;
  /** The user changed the value of a field. */
  onEdit(name: string | undefined): void;
}

export const formKey: InjectionKey<FormForField> = Symbol('form');
