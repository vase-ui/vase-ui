import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import * as RadioRootDataAttributes from '../root/RadioRootDataAttributes';

export const stateAttributesMapping = {
  checked(value): Record<string, string> {
    if (value) {
      return { [RadioRootDataAttributes.checked]: '' };
    }
    return { [RadioRootDataAttributes.unchecked]: '' };
  },
  ...transitionStatusMapping,
  ...fieldValidityMapping,
} satisfies StateAttributesMapping<{
  checked: boolean;
  transitionStatus: TransitionStatus;
  valid: boolean | null;
}>;
