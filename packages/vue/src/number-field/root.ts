import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import { fieldStateAttributes, type FieldForControl } from '../field/control';
import type { NumberText } from './text';
import type {
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventReason,
  NumberFieldRootState,
} from './types';

/** The modifier keys of an event, which select the amount of a step. */
export interface StepKeys {
  altKey: boolean;
  shiftKey: boolean;
}

/** What `NumberField.Root` gives to its parts. The properties are reactive. */
export interface NumberFieldContext {
  readonly state: NumberFieldRootState;
  readonly text: NumberText;
  readonly field: FieldForControl | null;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly form: string | undefined;
  readonly allowWheelScrub: boolean;
  /** The user can type a minus sign: the range holds a negative number. */
  readonly negative: boolean;
  /** The id of the text input, while one is mounted. */
  readonly inputId: string | undefined;
  readonly hiddenInput: HTMLInputElement | null;
  /** Makes `input` the text input of the root. Returns the function that removes it. */
  setInput(input: { readonly element: HTMLInputElement; readonly id: string }): () => void;
  /** The value cannot go further in the direction. */
  atBound(direction: 1 | -1): boolean;
  /** The user typed `text`, which the input accepts. */
  edit(text: string, reason: 'input-change' | 'input-paste', event: Event): void;
  /** The input shows `text` and the value stays, as for the text of an open composition. */
  holdText(text: string): void;
  /** The text input got the focus. */
  startEdit(): void;
  /** The text input lost the focus. */
  endEdit(event: FocusEvent): void;
  /**
   * Steps the value `count` times. Returns the new value when it changed and no listener cancelled
   * the change.
   */
  step(
    direction: 1 | -1,
    keys: StepKeys,
    reason: NumberFieldRootChangeEventReason,
    event: Event,
    count?: number,
  ): number | undefined;
  /** Sets the value. Returns `false` when a listener cancelled the change. */
  change(value: number | null, reason: NumberFieldRootChangeEventReason, event: Event): boolean;
  commit(value: number | null, reason: NumberFieldRootCommitEventReason, event: Event): void;
  /** Moves the focus to the text input, with the caret at the end. */
  focusInput(): void;
  /** A scrub area starts or ends a scrub. */
  setScrubbing(scrubbing: boolean): void;
}

export const numberFieldKey: InjectionKey<NumberFieldContext> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'number field' : undefined,
);

export function injectNumberFieldRoot(part: string) {
  const root = inject(numberFieldKey, null);
  if (!root) {
    throw createError(40, part);
  }
  return root;
}

type StateAttribute = 'disabled' | 'readonly' | 'required' | 'invalid';

/**
 * The data attributes of the state on the element of a part, with an empty value for each one
 * that is on. A part omits each state that a CSS or an ARIA selector of its element gives.
 */
export function stateAttributes(state: NumberFieldRootState, omit: StateAttribute[] = []) {
  const on = (key: StateAttribute, value: boolean) =>
    value && !omit.includes(key) ? '' : undefined;
  return {
    ...fieldStateAttributes(state, on('disabled', state.disabled) === ''),
    'data-invalid': on('invalid', state.valid === false),
    'data-readonly': on('readonly', state.readonly),
    'data-required': on('required', state.required),
    'data-scrubbing': state.scrubbing ? '' : undefined,
  };
}
