import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { CompositeListContextValue } from '../../internals/composite/list/useCompositeList';
import type { useInputRender } from '../../internals/useInputRender';
import type { OTPFieldInputState } from '../input/OTPFieldInput.vue';
import type {
  OTPFieldRootChangeEventDetails,
  OTPFieldRootInvalidEventDetails,
  OTPFieldRootState,
  OTPFieldRootProps,
} from './OTPFieldRoot.vue';

export interface OTPFieldRootContext {
  inputRender: ReturnType<typeof useInputRender>;
  activeIndex: ComputedRef<number>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  controlId: ComputedRef<string | undefined>;
  options: Readonly<
    Pick<OTPFieldRootProps, 'autoComplete' | 'form' | 'mask' | 'normalizeValue'>
  > & {
    readonly validationType: OTPValidationType;
  };
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent) => void;
  /**
   * The list of the inputs. The inputs register with it through this context. The root does not
   * provide the list, so an item of a composite around the root joins that composite.
   */
  inputList: CompositeListContextValue<unknown>;
  inputMode: ComputedRef<OTPFieldInputMode | undefined>;
  inputAriaLabelledBy: ComputedRef<string | undefined>;
  invalid: ComputedRef<boolean | undefined>;
  pattern: ComputedRef<string | undefined>;
  reportValueInvalid: (value: string, details: OTPFieldRootInvalidEventDetails) => void;
  setFocused: (focused: boolean) => void;
  setValue: (value: string, details: OTPFieldRootChangeEventDetails) => string | null;
  state: ComputedRef<OTPFieldRootState>;
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

export const rootStateAttributesMapping: StateAttributesMapping<OTPFieldRootState> = {
  value: () => null,
  length: () => null,
  ...fieldValidityMapping,
};

export const inputStateAttributesMapping: StateAttributesMapping<OTPFieldInputState> = {
  value: () => null,
  index: () => null,
  ...fieldValidityMapping,
};

interface OTPValidationConfig {
  slotPattern: string;
  getRootPattern: (length: number) => string;
  regexp: RegExp;
  inputMode: 'numeric' | 'text';
}

export type OTPValidationType = 'numeric' | 'alpha' | 'alphanumeric' | 'none';

const OTP_VALIDATION_CONFIG: Record<Exclude<OTPValidationType, 'none'>, OTPValidationConfig> = {
  numeric: {
    slotPattern: '\\d{1}',
    getRootPattern: (length) => `\\d{${length}}`,
    regexp: /[^\d]/g,
    inputMode: 'numeric',
  },
  alpha: {
    slotPattern: '[a-zA-Z]{1}',
    getRootPattern: (length) => `[a-zA-Z]{${length}}`,
    regexp: /[^a-zA-Z]/g,
    inputMode: 'text',
  },
  alphanumeric: {
    slotPattern: '[a-zA-Z0-9]{1}',
    getRootPattern: (length) => `[a-zA-Z0-9]{${length}}`,
    regexp: /[^a-zA-Z0-9]/g,
    inputMode: 'text',
  },
};

export function getOTPValidationConfig(validationType: OTPValidationType) {
  if (validationType === 'none') {
    return null;
  }

  return OTP_VALIDATION_CONFIG[validationType];
}

export function stripOTPWhitespace(value: string | null | undefined) {
  return (value ?? '').replaceAll(/\s/g, '');
}

function applyOTPValidation(value: string, validation: OTPValidationConfig | null) {
  return validation ? value.replace(validation.regexp, '') : value;
}

/**
 * Normalizes user-entered OTP text by stripping whitespace, applying validation and custom
 * normalization, and clamping the final value to the configured slot count.
 */
export function normalizeOTPValueWithDetails(
  value: string | null | undefined,
  length: number,
  validationType: OTPValidationType,
  normalizeValue?: (value: string) => string,
): readonly [value: string, didRejectCharacters: boolean] {
  const strippedValue = stripOTPWhitespace(value);
  const validation = getOTPValidationConfig(validationType);
  let normalizedValue = applyOTPValidation(strippedValue, validation);
  let didRejectCharacters = strippedValue.length > normalizedValue.length;

  if (normalizeValue) {
    const customNormalizedValue = normalizeValue(normalizedValue);
    didRejectCharacters ||= normalizedValue.length > customNormalizedValue.length;
    normalizedValue = applyOTPValidation(customNormalizedValue, validation);
    didRejectCharacters ||= customNormalizedValue.length > normalizedValue.length;
  }

  // Slice by Unicode code points so multi-byte characters do not split across OTP slots.
  const maxLength = length < 0 ? 0 : length;
  const normalizedCharacters = Array.from(normalizedValue);

  return [
    normalizedCharacters.slice(0, maxLength).join(''),
    didRejectCharacters || normalizedCharacters.length > maxLength,
  ];
}

export function normalizeOTPValue(
  value: string | null | undefined,
  length: number,
  validationType: OTPValidationType,
  normalizeValue?: (value: string) => string,
) {
  return normalizeOTPValueWithDetails(value, length, validationType, normalizeValue)[0];
}

/**
 * Replaces characters starting at the provided slot index, then re-normalizes the final OTP value
 * so paste and multi-character edits stay contiguous and length-bounded.
 */
export function replaceOTPValue(
  currentValue: string,
  index: number,
  nextValue: string,
  length: number,
  validationType: OTPValidationType,
  normalizeValue?: (value: string) => string,
) {
  const normalizedValue = normalizeOTPValue(nextValue, length, validationType, normalizeValue);
  const prefix = currentValue.slice(0, index);
  const suffix = currentValue.slice(index + normalizedValue.length);

  return normalizeOTPValue(
    `${prefix}${normalizedValue}${suffix}`,
    length,
    validationType,
    normalizeValue,
  );
}

export function removeOTPCharacter(currentValue: string, index: number) {
  if (index < 0 || index >= currentValue.length) {
    return currentValue;
  }

  return `${currentValue.slice(0, index)}${currentValue.slice(index + 1)}`;
}
