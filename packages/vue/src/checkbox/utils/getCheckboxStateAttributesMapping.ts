import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { CheckboxRootState } from '../root/CheckboxRoot.vue';
import * as CheckboxRootDataAttributes from '../root/CheckboxRootDataAttributes';

/**
 * @param state The state of the checkbox. A part calls this function one time in `setup`, so the
 * state is a ref or a getter. The mapping reads it when it runs.
 */
export function getCheckboxStateAttributesMapping(
  state: MaybeRefOrGetter<CheckboxRootState>,
): StateAttributesMapping<CheckboxRootState> {
  return {
    checked(value): Record<string, string> {
      if (toValue(state).indeterminate) {
        // The key `indeterminate` of the state gives `data-indeterminate`.
        return {};
      }

      if (value) {
        return { [CheckboxRootDataAttributes.checked]: '' };
      }

      return { [CheckboxRootDataAttributes.unchecked]: '' };
    },
    ...fieldValidityMapping,
  };
}
