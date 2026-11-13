import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import type { SwitchRootState } from './root/SwitchRoot.vue';
import * as SwitchRootDataAttributes from './root/SwitchRootDataAttributes';

export const stateAttributesMapping: StateAttributesMapping<SwitchRootState> = {
  ...fieldValidityMapping,
  checked(value): Record<string, string> {
    if (value) {
      return { [SwitchRootDataAttributes.checked]: '' };
    }

    return { [SwitchRootDataAttributes.unchecked]: '' };
  },
};
