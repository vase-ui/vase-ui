import type { HTMLAttributes } from 'vue';
import type { ChangeEventDetails, GenericEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { FieldState } from '../field/control';

/** The characters that a slot accepts. `none` accepts each character. */
export type OTPFieldRootValidationType = 'numeric' | 'alpha' | 'alphanumeric' | 'none';

export interface OTPFieldRootProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id' | 'inputmode'> {
  /**
   * The number of slots. The root cuts the code to it and finds the completion from it. The form
   * input then has the validation of a whole code before the slots hydrate.
   */
  length: number;
  /** The code. With no value, the field owns its code. */
  modelValue?: string;
  /** The first code of a field that owns its code. */
  defaultValue?: string;
  /**
   * The characters that a slot accepts.
   * @default 'numeric'
   */
  validationType?: OTPFieldRootValidationType;
  /**
   * Changes the code after the field removes whitespace and each character that `validationType`
   * refuses. It runs for the first code, for each model value and for each edit. The filter of
   * `validationType` then runs on its result again, and the field cuts the result to `length`.
   * The field can run it more than one time on the same code, so give it the same result for its
   * own result. `valueInvalid` tells when it refuses a character of typed or pasted text.
   */
  normalizeValue?: (value: string) => string;
  /**
   * The keyboard hint of the slots and of the form input. With none, the hint follows
   * `validationType`.
   */
  inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /**
   * The `autocomplete` of the first slot and of the form input.
   * @default 'one-time-code'
   */
  autocomplete?: string;
  /**
   * The field submits its form when the code becomes complete.
   * @default false
   */
  autoSubmit?: boolean;
  /** The `id` of the first slot. The other slots get `{id}-2`, `{id}-3`, and on. */
  id?: string;
  /**
   * The name of the code in the form data. The form input gives the whole code, and the slots have
   * no name. The name of a `Field.Root` wins.
   */
  name?: string;
  /** The `id` of the form that owns the inputs of the field, for a field outside that form. */
  form?: string;
  /**
   * The user must give a code before a submit.
   * @default false
   */
  required?: boolean;
  /**
   * The user cannot change the code, and the form data has no code.
   * @default false
   */
  disabled?: boolean;
  /**
   * The user cannot change the code. The slots stay in the tab order.
   * @default false
   */
  readonly?: boolean;
}

export interface OTPFieldRootState extends FieldState {
  /** Each slot has a character. */
  complete: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  /** The number of slots. */
  length: number;
  /** The code. */
  value: string;
}

export interface OTPFieldInputState extends OTPFieldRootState {
  /** The slot has a character. */
  filled: boolean;
  /** The character of the slot. */
  value: string;
  /** The place of the slot, from 0. */
  index: number;
}

export type OTPFieldRootChangeEventReason =
  'input-change' | 'input-clear' | 'input-paste' | 'keyboard';
export type OTPFieldRootChangeEventDetails =
  | ChangeEventDetails<'input-change' | 'input-clear', InputEvent | Event>
  | ChangeEventDetails<'input-paste', ClipboardEvent>
  | ChangeEventDetails<'keyboard', KeyboardEvent>;

export type OTPFieldRootInvalidEventReason = 'input-change' | 'input-paste';
export type OTPFieldRootInvalidEventDetails =
  | GenericEventDetails<'input-change', InputEvent | Event>
  | GenericEventDetails<'input-paste', ClipboardEvent>;

export type OTPFieldRootCompleteEventReason = OTPFieldRootInvalidEventReason;
export type OTPFieldRootCompleteEventDetails = OTPFieldRootInvalidEventDetails;
