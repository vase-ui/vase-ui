import { computed, customRef, inject } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import type { FormValidationMode } from '../form-context/FormContext';
import { NOOP } from '../noop';

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
}

/**
 * What a control gives to its field. The object has the values of the moment of the read.
 */
export interface FieldControlRegistration {
  controlRef: MaybeRefOrGetter<HTMLElement | null>;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

export interface RegisteredInput {
  controlRef: MaybeRefOrGetter<HTMLElement | null>;
  value: string | undefined;
}

export type RegisteredInputs = ReadonlyMap<HTMLInputElement, RegisteredInput>;

export interface UseFieldValidationReturnValue {
  getValidationProps: (disabled: boolean, props?: Record<string, any>) => Record<string, any>;
  inputRef: ShallowRef<HTMLInputElement | null>;
  registeredInputs: RegisteredInputs;
  registerInput: (element: HTMLInputElement, registration: RegisteredInput) => void | (() => void);
  getInputControl: () => HTMLElement | null;
  /**
   * Validates the value. A field does not count `valueMissing` until the user changes the value or
   * the form validates the field. A control that has no text to type gives `true` for
   * `countValueMissing`. The field is then invalid when an input reports `valueMissing`, with no
   * earlier change.
   */
  commit: (value: unknown, countValueMissing?: boolean) => Promise<void>;
  change: (value: unknown, cancelPending?: boolean) => void;
  reset: () => void;
}

export interface FieldRootContext {
  invalid: ComputedRef<boolean | undefined>;
  name: ComputedRef<string | undefined>;
  validityData: Readonly<Ref<FieldValidityData>>;
  setValidityData: (validityData: FieldValidityData) => void;
  disabled: ComputedRef<boolean | undefined>;
  setTouched: (touched: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setFilled: (filled: boolean) => void;
  setFocused: (focused: boolean) => void;
  /**
   * Identifies the control the focused state belongs to, so that disabling or unmounting a
   * different control in the same field can't clear it. Written through `useSetFieldFocused`.
   * It is `null` when there is no field. A control then keeps the owner itself.
   */
  focusOwnerRef: Ref<unknown> | null;
  validationMode: ComputedRef<FormValidationMode>;
  shouldValidateOnChange: () => boolean;
  state: ComputedRef<FieldRootState>;
  /**
   * Registers a control by source, or removes the registration when `getRegistration` is
   * `undefined`. The field calls the getter each time it needs the control. The getter returns
   * `undefined` for a control that the field must not use now, such as a control that `KeepAlive`
   * has deactivated. A control calls the function again with the same source when its `id`, its
   * `name`, its value or `enabled` changes. The field uses the control of the last call whose
   * getter returns a registration.
   */
  registerFieldControl: (
    source: symbol,
    getRegistration: (() => FieldControlRegistration | undefined) | undefined,
  ) => void;
  validation: UseFieldValidationReturnValue;
}

const DEFAULT_VALIDITY_DATA: FieldValidityData = {
  state: DEFAULT_VALIDITY_STATE,
  errors: [],
  error: '',
  value: '',
  initialValue: null,
};

// All apps and all server requests share this object, so it holds no state.
export const DEFAULT_FIELD_ROOT_CONTEXT: FieldRootContext = {
  invalid: computed(() => undefined),
  name: computed(() => undefined),
  validityData: computed(() => DEFAULT_VALIDITY_DATA),
  setValidityData: NOOP,
  disabled: computed(() => undefined),
  setTouched: NOOP,
  setDirty: NOOP,
  setFilled: NOOP,
  setFocused: NOOP,
  focusOwnerRef: null,
  validationMode: computed(() => 'onSubmit'),
  shouldValidateOnChange: () => false,
  state: computed(() => DEFAULT_FIELD_ROOT_STATE),
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: (_disabled, props = EMPTY_OBJECT) => props,
    // Each control with no field writes its input here. The ref keeps none of them.
    inputRef: customRef(() => ({ get: () => null, set: NOOP })),
    registeredInputs: new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: async () => {},
    change: NOOP,
    reset: NOOP,
  },
};

export const FieldRootContext: InjectionKey<FieldRootContext> = Symbol();

/**
 * Gives the context of the nearest field, or a context that does nothing when there is none.
 * A control then works with no field around it.
 * To find out if a field is there, compare `setValidityData` with `NOOP`.
 */
export function useFieldRootContext(optional = true): FieldRootContext {
  const context = inject(FieldRootContext, DEFAULT_FIELD_ROOT_CONTEXT);

  if (context.setValidityData === NOOP && !optional) {
    throw new Error(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );
  }

  return context;
}
