import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { OTPFieldInputState } from '../input/OTPFieldInput.vue';
import type {
  OTPFieldRootChangeEventDetails,
  OTPFieldRootInvalidEventDetails,
  OTPFieldRootState,
  OTPFieldRootValidationType,
} from './OTPFieldRoot.vue';

export interface OTPFieldRootContext {
  activeIndex: ComputedRef<number>;
  autoComplete: ComputedRef<string | undefined>;
  disabled: ComputedRef<boolean>;
  form: ComputedRef<string | undefined>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent) => void;
  inputMode: ComputedRef<OTPFieldInputMode | undefined>;
  inputAriaLabelledBy: ComputedRef<string | undefined>;
  invalid: ComputedRef<boolean | undefined>;
  length: ComputedRef<number>;
  mask: ComputedRef<boolean>;
  pattern: ComputedRef<string | undefined>;
  reportValueInvalid: (value: string, details: OTPFieldRootInvalidEventDetails) => void;
  readOnly: ComputedRef<boolean>;
  required: ComputedRef<boolean>;
  normalizeValue: ComputedRef<((value: string) => string) | undefined>;
  setFocused: (focused: boolean) => void;
  setValue: (value: string, details: OTPFieldRootChangeEventDetails) => string | null;
  state: ComputedRef<OTPFieldRootState>;
  validationType: ComputedRef<OTPFieldRootValidationType>;
  value: ComputedRef<string>;
}

export type OTPFieldInputMode =
  'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

export const OTPFieldRootContext: InjectionKey<OTPFieldRootContext> = Symbol();

export function useOTPFieldRootContext(): OTPFieldRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(OTPFieldRootContext, undefined);

  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of OTP Field must be inside <OTPField.Root>. Without a root the part has no value to show. Put the part inside <OTPField.Root>.',
    );
  }

  return context;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: string,
  index: number,
): OTPFieldInputState {
  return {
    ...state,
    value,
    index,
    filled: value !== '',
  };
}
