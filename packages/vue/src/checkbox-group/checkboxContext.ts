import { toValue } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import type { CheckboxRootState } from '../checkbox/root/CheckboxRoot.vue';
import * as CheckboxRootDataAttributes from '../checkbox/root/CheckboxRootDataAttributes';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { UseFieldValidationReturnValue } from '../internals/field-root-context/FieldRootContext';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import type { LabelableContext } from '../internals/labelable-provider/LabelableContext';
import type { CheckboxGroupChangeEventDetails } from './CheckboxGroup.vue';

export const CheckboxRootContext: InjectionKey<ComputedRef<CheckboxRootState>> = Symbol();

interface CheckboxGroupContext {
  value: ComputedRef<string[]>;
  parent: ComputedRef<
    { checked: boolean; indeterminate: boolean; controls: string | undefined } | undefined
  >;
  toggleParent: (details: CheckboxGroupChangeEventDetails) => void;
  setChildChecked: (
    value: string,
    checked: boolean,
    details: CheckboxGroupChangeEventDetails,
  ) => void;
  registerChildId: (value: string, id: string) => () => void;
  registerDisabled: (value: string, disabled: boolean) => () => void;
  disabled: ComputedRef<boolean>;
  validation: UseFieldValidationReturnValue;
  registerControlId: LabelableContext['registerControlId'];
  reset: (event: Event) => void;
}

export const CheckboxGroupContext: InjectionKey<CheckboxGroupContext> = Symbol();

export function getCheckboxStateAttributesMapping(
  state: MaybeRefOrGetter<CheckboxRootState>,
): StateAttributesMapping<CheckboxRootState> {
  return {
    ...fieldValidityMapping,
    checked(value) {
      if (toValue(state).indeterminate) return null;
      return {
        [value ? CheckboxRootDataAttributes.checked : CheckboxRootDataAttributes.unchecked]: '',
      };
    },
  };
}
