import type { InjectionKey } from 'vue';

export interface FieldState {
  /** The focus left the control one time or more. */
  touched: boolean;
  /** The value differs from the first value of the field. */
  dirty: boolean;
  /** `null` while the field has no validity. */
  valid: boolean | null;
  filled: boolean;
}

/** A native element with constraint validation. */
export type NativeControl = HTMLInputElement | HTMLTextAreaElement;

/** What a control tells its field about itself. The properties are reactive. */
export interface FieldControl {
  /** The element that has the role: the input, or the element of a group. */
  readonly element: HTMLElement;
  readonly id: string;
  /** The `name` of the control, for a field with no name. */
  readonly name: string | undefined;
  /** The control is disabled by its own prop or by a fieldset around it, not by its field. */
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** The native elements whose constraint validation stands for the control. */
  readonly inputs: readonly NativeControl[];
  /**
   * The element that gets the focus when a form finds the field invalid. With none, it is the
   * first element of `inputs` that fails, or else the first one.
   */
  readonly focusElement?: HTMLElement | undefined;
}

/**
 * What a field gives to its control, and the calls that tell the field what happens to the
 * control. The properties are reactive.
 */
export interface FieldForControl {
  /** Wins over the `disabled` prop of the control. */
  readonly disabled: boolean;
  /** Wins over the `name` prop of the control. */
  readonly name: string | undefined;
  /** The id of a control that has no `id` prop. */
  readonly controlId: string | undefined;
  /** The id of the label, for a group that a `<label for>` cannot name. */
  readonly labelId: string | undefined;
  /** The ids of the descriptions and of the errors that show. */
  readonly describedBy: string | undefined;
  readonly state: Readonly<FieldState>;
  /** Makes the control the control of the field. Returns the function that removes it. */
  setControl(control: FieldControl): () => void;
  /** The value at the mount and after each change, and if it is not empty. */
  setValue(value: unknown, filled: boolean): void;
  /** The user changed the value. The control calls `setValue` first. */
  onEdit(): void;
  /** The focus left the control. */
  onLeave(): void;
  /** A native reset of the form of the control, which gave the control `value`. */
  onReset(value: unknown): void;
}

export const fieldKey: InjectionKey<FieldForControl> = Symbol('field');

/**
 * The data attributes of the state of a field, with an empty value for each one that is on. A
 * control gives no `disabled`, because `:disabled` matches its native element.
 */
export function fieldStateAttributes(state: FieldState, disabled?: boolean) {
  const on = (value: boolean | undefined) => (value ? '' : undefined);
  return {
    'data-disabled': on(disabled),
    'data-valid': on(state.valid === true),
    'data-invalid': on(state.valid === false),
    'data-touched': on(state.touched),
    'data-dirty': on(state.dirty),
    'data-filled': on(state.filled),
  };
}

/**
 * The attributes that a field gives to the element of its control. `aria-invalid` says the invalid
 * state, so the element has no `data-invalid`.
 */
export function controlAttributes(field: FieldForControl) {
  return {
    ...fieldStateAttributes(field.state),
    'data-invalid': undefined,
    'aria-invalid': field.state.valid === false ? 'true' : undefined,
    'aria-describedby': field.describedBy,
  };
}
