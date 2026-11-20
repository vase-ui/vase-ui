import type { Component, HTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';

/** The characters that a slot accepts. `none` accepts each character. */
export type OTPFieldRootValidationType = 'numeric' | 'alpha' | 'alphanumeric' | 'none';

export interface OTPFieldRootProps extends /* @vue-ignore */ Omit<
  HTMLAttributes,
  'id' | 'inputmode'
> {
  /** The element or the component that the root renders in place of its `<div>`. */
  as?: keyof HTMLElementTagNameMap | Component;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * The OTP value.
   */
  modelValue?: string;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRootValidationType;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `valueInvalid`.
   */
  normalizeValue?: (value: string) => string;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autocomplete?: string;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean;
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readonly?: boolean;
}

export interface OTPFieldRootState extends FieldState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to change the field value.
   */
  readonly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * The OTP value.
   */
  value: string;
}

export interface OTPFieldInputState extends OTPFieldRootState {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The character rendered in this slot.
   */
  value: string;
  /**
   * The input index.
   */
  index: number;
}

interface Details<Reason extends string, Of extends Event> extends ChangeEventDetails<Reason> {
  event: Of;
}

export type OTPFieldRootChangeEventReason =
  'input-change' | 'input-clear' | 'input-paste' | 'keyboard';
export type OTPFieldRootChangeEventDetails =
  | Details<'input-change' | 'input-clear', InputEvent | Event>
  | Details<'input-paste', ClipboardEvent>
  | Details<'keyboard', KeyboardEvent>;

export type OTPFieldRootInvalidEventReason = 'input-change' | 'input-paste';
export type OTPFieldRootInvalidEventDetails =
  | { reason: 'input-change'; event: InputEvent | Event }
  | { reason: 'input-paste'; event: ClipboardEvent };

export type OTPFieldRootCompleteEventReason = OTPFieldRootInvalidEventReason;
export type OTPFieldRootCompleteEventDetails = OTPFieldRootInvalidEventDetails;
