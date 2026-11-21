import { inject, type InjectionKey } from 'vue';
import type { OTPFieldRootState } from './types';

/** What `OTPField.Root` gives to its slots. The properties are reactive. */
export interface OTPFieldForInput {
  /** The characters of the code. Slot n shows character n. */
  readonly characters: readonly string[];
  readonly state: OTPFieldRootState;
  /** The `id` of the first slot. */
  readonly id: string;
  readonly inputmode: string | undefined;
  readonly autocomplete: string;
  readonly form: string | undefined;
  readonly maxlength: number;
  /** The label of the field or the legend, for a slot with no name of its own. */
  readonly labelledBy: string | undefined;
  /** The index of the end slot: the first empty slot, or the last slot of a complete code. */
  readonly end: number;
  /** The index of the slot in the tab order. */
  readonly tabStop: number;
  /** A place for the server render and the first render. */
  claimIndex(): number;
  /** The place of a mounted slot in the document, or -1. */
  indexOf(slot: HTMLInputElement | null): number;
  /** Adds a mounted slot. Returns the function that removes it. */
  addSlot(slot: HTMLInputElement): () => void;
  /** Text of the user in a slot: typed, composed, filled or pasted. */
  enter(index: number, text: string, reason: 'input-change' | 'input-paste', event: Event): void;
  /** Backspace or Delete in a slot. `all` clears the code. */
  remove(index: number, key: 'Backspace' | 'Delete', all: boolean, event: KeyboardEvent): void;
  focusSlot(index: number): void;
  /** A slot got the focus. */
  onFocus(index: number, slot: HTMLInputElement): void;
  /** The `keydown` of Enter in a slot. */
  onEnter(event: KeyboardEvent): void;
}

export const otpFieldKey: InjectionKey<OTPFieldForInput> = Symbol('otp field');

export function injectOTPFieldRoot() {
  const root = inject(otpFieldKey, null);
  if (!root) {
    throw new Error(
      'Vase UI: A part of OTP Field must be inside <OTPField.Root>. Without a root the part has no value to show. Put the part inside <OTPField.Root>.',
    );
  }
  return root;
}
