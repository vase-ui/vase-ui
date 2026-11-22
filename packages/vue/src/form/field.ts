import type { InjectionKey } from 'vue';

export type FormValidationMode = 'submit' | 'blur' | 'change';

/** Errors by the name of a field. */
export type FormErrors = Record<string, string | string[]>;

/** The values of the fields of a form, by the name of each field. */
export type FormValues = Record<string, any>;

/** What a field gives to its form. */
export interface FormField {
  readonly name: string | undefined;
  /** The element that gets the focus when the form finds the field invalid. */
  readonly element: HTMLElement | undefined;
  /** The value of the field in the values of `form`. */
  valueIn(form: HTMLFormElement): unknown;
  /** A disabled field has no entry in the values of the form. */
  readonly disabled: boolean;
  /** Validates the field at once. It does not wait for an async `validate`. */
  validate(): void;
  readonly invalid: boolean;
}

/** What a form gives to its fields. The properties are reactive. */
export interface FormForField {
  /** The `<form>` element. A field reads no input that another form owns. */
  readonly element: HTMLFormElement | null;
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
  /** The values of the named fields of the form that are not disabled. */
  values(): FormValues;
}

export const formKey: InjectionKey<FormForField> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'form' : undefined,
);
