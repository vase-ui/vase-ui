import { computed, inject, onBeforeUnmount, provide, shallowRef } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { REASONS } from '../../reasons';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { usePopoverRootContext } from '../../../popover/root/PopoverRootContext';
import type { FocusOption } from '../../../utils/popups/focus/FloatingFocusManager';
import { createDefaultInitialFocus } from '../../../utils/popups/popupStoreUtils';

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

/** Gives the element that takes the focus when the popup opens, such as the day that has the tab stop. */
export type PickerFocusTarget = () => Element | null | undefined;

const PickerFocusTargetContext: InjectionKey<ShallowRef<PickerFocusTarget | null>> = Symbol();

/**
 * The popup part of a picker calls it in `setup`, and gives the result to `Popover.Popup` as
 * `initialFocus`. The focus manager asks for the element at each open, also of a popup that stays
 * mounted. The default is the target that a part of the popup registered with
 * `usePickerFocusTarget`. Without that default, the focus manager would take the first tabbable
 * element, which is a navigation button. A popup with no target keeps the default of
 * `Popover.Popup`.
 * @param initialFocus The `initialFocus` prop of the part. A value of the consumer replaces the
 * default, also `false`.
 */
export function usePickerInitialFocus(
  initialFocus: () => FocusOption | undefined,
): ComputedRef<FocusOption> {
  const store = usePopoverRootContext();
  const target = shallowRef<PickerFocusTarget | null>(null);
  provide(PickerFocusTargetContext, target);

  const popupDefault = createDefaultInitialFocus(store.context.popupRef);
  const pickerDefault = (interactionType: InteractionType) =>
    target.value?.() ?? popupDefault(interactionType);

  return computed(() => initialFocus() ?? pickerDefault);
}

/**
 * A part of the popup that shows the choices of a picker, such as the calendar, calls it in
 * `setup`. `target` gives the element that the pattern names: the selected day, or else the first
 * day that the user can pick. It gives `null` while the part has no such element. A popup has one
 * target, and a part that mounts later replaces the target of an earlier part.
 */
export function usePickerFocusTarget(target: PickerFocusTarget): void {
  const registry = inject(PickerFocusTargetContext, null);
  if (!registry) {
    return;
  }
  registry.value = target;
  onBeforeUnmount(() => {
    if (registry.value === target) {
      registry.value = null;
    }
  });
}
