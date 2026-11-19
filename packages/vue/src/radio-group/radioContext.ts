import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../internals/stateAttributesMapping';
import type { TransitionStatus } from '../internals/useTransitionStatus';
import type { RadioRootState } from '../radio/root/RadioRoot.vue';
import * as RadioRootDataAttributes from '../radio/root/RadioRootDataAttributes';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createVaseUIEventDetails';
import type { UseFieldValidationReturnValue } from '../internals/field-root-context/FieldRootContext';
import type { VaseUIEventReasons } from '../internals/reasons';

export interface RadioInput {
  take: (event?: Event) => void;
  restore: () => void;
}

export interface RadioGroupContext<Value> {
  disabled: ComputedRef<boolean>;
  readOnly: ComputedRef<boolean>;
  required: ComputedRef<boolean>;
  form: ComputedRef<string | undefined>;
  name: ComputedRef<string | undefined>;
  checkedValue: Readonly<Ref<Value | undefined>>;
  setCheckedValue: (
    value: Value,
    eventDetails: VaseUIChangeEventDetails<VaseUIEventReasons['none']>,
  ) => void;
  touched: Readonly<Ref<boolean>>;
  setTouched: (touched: boolean) => void;
  validation: UseFieldValidationReturnValue;
  registerInput: (input: HTMLInputElement, actions: RadioInput) => () => void;
  refreshInput: (input: HTMLInputElement) => void;
  takeInputsAfterMount: () => void;
  reset: (event: Event) => void;
}

export const RadioGroupContext: InjectionKey<RadioGroupContext<any>> = Symbol();

export const RadioRootContext: InjectionKey<ComputedRef<RadioRootState>> = Symbol();

export const stateAttributesMapping = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
  checked(value) {
    return { [value ? RadioRootDataAttributes.checked : RadioRootDataAttributes.unchecked]: '' };
  },
} satisfies StateAttributesMapping<{
  checked: boolean;
  transitionStatus: TransitionStatus;
  valid: boolean | null;
}>;
