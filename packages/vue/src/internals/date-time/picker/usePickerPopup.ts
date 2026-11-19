import { inject } from 'vue';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import { REASONS } from '../../reasons';
import { usePopoverRootContext } from '../../../popover/root/PopoverRootContext';
import { RegisterPickerFocusTarget } from './PickerControlContext';
import type { PickerFocusTarget } from './PickerControlContext';

export function usePickerPopup() {
  const { open, requestOpen, store } = usePopoverRootContext();

  function openByKey(event: KeyboardEvent) {
    if (!open.value) {
      const [firstTrigger] = store.context.triggerElements.entries();
      requestOpen(true, createChangeEventDetails(REASONS.triggerPress, event, firstTrigger?.[1]));
    }
  }

  function closeAfterSelection(event: Event) {
    requestOpen(false, createChangeEventDetails(REASONS.imperativeAction, event));
  }

  return { open, openByKey, closeAfterSelection };
}

export function usePickerFocusTarget(target: PickerFocusTarget): void {
  inject(RegisterPickerFocusTarget, null)?.(target);
}
