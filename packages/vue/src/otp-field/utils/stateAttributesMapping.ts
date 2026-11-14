import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { OTPFieldRootState } from '../root/OTPFieldRoot.vue';

export const rootStateAttributesMapping: StateAttributesMapping<OTPFieldRootState> = {
  value: () => null,
  length: () => null,
  ...fieldValidityMapping,
};
