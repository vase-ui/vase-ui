import type { InjectionKey } from 'vue';

export type ValidationMode = 'submit' | 'blur' | 'change';

/** What a field gives to its form while it has a control that is mounted, shown and enabled. */
export interface FormField {
  readonly name: string | undefined;
  /** The element of the control, for the focus. */
  readonly element: HTMLElement;
  /** Validates the field at once. It does not wait for an async `validate`. */
  validate(): void;
  readonly invalid: boolean;
}

/** What a form gives to its fields. The properties are reactive. */
export interface FormForField {
  readonly validationMode: ValidationMode;
  /** The form had a submit, also a blocked one, since its mount or its last native reset. */
  readonly submitted: boolean;
  readonly errors: Readonly<Record<string, string | string[]>> | undefined;
  readonly element: HTMLFormElement | null;
  addField(field: FormField): () => void;
  /** The user changed the value of the field with this name. */
  clearError(name: string): void;
}

export const formKey: InjectionKey<FormForField> = Symbol('form');
