import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../common/empty';
import type { FieldValidityData } from '../field-root-context/FieldRootContext';
import { NOOP } from '../noop';

export type Errors = Record<string, string | string[]>;

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

/**
 * What a form reads from one field. The object has the values of the moment of the read.
 * Read `fields` again after a call of `validate`.
 */
export interface FormField {
  name: string | undefined;
  /**
   * After this returns, a new read of `fields` has the latest synchronous validity verdict.
   * Async validators do not block submit.
   */
  validate: () => void;
  validityData: FieldValidityData;
  controlRef: MaybeRefOrGetter<HTMLElement | null>;
  getValue: () => unknown;
}

export interface FormContext {
  errors: ComputedRef<Errors>;
  clearErrors: (name: string | undefined) => void;
  elementRef: Readonly<Ref<HTMLFormElement | null>>;
  /**
   * The fields that have a control now, in the order of their registrations.
   * A field whose control `KeepAlive` has deactivated is not in the list.
   */
  fields: ComputedRef<FormField[]>;
  /**
   * Registers a field by source, or removes the registration when `getField` is `undefined`.
   * The form calls the getter each time it reads `fields`, so a field registers one time and
   * keeps its place. The getter returns `undefined` for a field that has no control now.
   */
  registerField: (source: symbol, getField: (() => FormField | undefined) | undefined) => void;
  validationMode: ComputedRef<FormValidationMode>;
  submitCountRef: Readonly<Ref<number>>;
}

export const FormContext: InjectionKey<FormContext> = Symbol();

// All apps and all server requests share this object, so it holds no state.
const DEFAULT_FORM_CONTEXT: FormContext = {
  errors: computed(() => EMPTY_OBJECT),
  clearErrors: NOOP,
  elementRef: computed(() => null),
  fields: computed(() => EMPTY_ARRAY),
  registerField: NOOP,
  validationMode: computed(() => 'onSubmit'),
  submitCountRef: computed(() => 0),
};

/**
 * Gives the context of the nearest form, or a context that does nothing when there is none.
 * A field then works with no form around it.
 */
export function useFormContext(): FormContext {
  return inject(FormContext, DEFAULT_FORM_CONTEXT);
}
