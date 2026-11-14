import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DialogPopupDataAttributes from '../popup/DialogPopupDataAttributes';

/**
 * For each part of Dialog whose state has `open`, `transitionStatus`, `nested` and
 * `nestedDialogOpen`. `nested` is not mapped: unmapped `true` booleans already render as
 * `data-nested`.
 */
export const dialogStateAttributesMapping: StateAttributesMapping<{
  open: boolean;
  transitionStatus: TransitionStatus;
  nested: boolean;
  nestedDialogOpen: boolean;
}> = {
  ...popupTransitionStateMapping,
  nestedDialogOpen(value) {
    return value ? { [DialogPopupDataAttributes.nestedDialogOpen]: '' } : null;
  },
};
