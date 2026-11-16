import { computed, onMounted, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { REASONS } from '../../reasons';
import { usePopoverRootContext } from '../../../popover/root/PopoverRootContext';

export interface PickerPopup {
  /** Whether the popup is open. */
  open: ComputedRef<boolean>;
  /**
   * Opens the popup for a key in the field, as a press of the trigger does. The popup then belongs
   * to the first trigger, so the trigger shows the open state and the focus returns to it. It does
   * nothing while the popup is open.
   */
  openByKey: (event: KeyboardEvent) => void;
  /** Closes the popup after a selection. The reason is `imperative-action`. */
  closeAfterSelection: (event: Event) => void;
}

/**
 * The popup of the popover root that renders a picker root. A part of the picker calls it in
 * `setup`.
 */
export function usePickerPopup(): PickerPopup {
  const store = usePopoverRootContext();
  const open = computed(() => store.select('open'));

  function openByKey(event: KeyboardEvent) {
    if (open.value) {
      return;
    }
    const [firstTrigger] = store.context.triggerElements.entries();
    store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event, firstTrigger?.[1]));
  }

  function closeAfterSelection(event: Event) {
    store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction, event));
  }

  return { open, openByKey, closeAfterSelection };
}

/**
 * Calls `focus` each time the popup opens while the part is mounted, and when the part mounts into
 * an open popup. The focus manager of the popup moves the focus to the first tabbable element one
 * frame after the open, but not when the focus has moved into the popup by then. The part thus
 * gives the focus to the element that the pattern names, such as the day with the tab stop.
 */
export function useFocusOnOpen(popup: Pick<PickerPopup, 'open'>, focus: () => void) {
  onMounted(() => {
    if (popup.open.value) {
      focus();
    }
  });
  watch(
    popup.open,
    (open) => {
      if (open) {
        focus();
      }
    },
    { flush: 'post' },
  );
}
