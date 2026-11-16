import { computed, inject, onBeforeUnmount, provide, unref } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { REASONS } from '../../reasons';
import { ownerWindow } from '../../../common/owner';
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

const PickerFocusTargetContext: InjectionKey<Set<PickerFocusTarget>> = Symbol();

// The cell of a month or a year has the tab stop itself, and the cell of a day has it in its button.
const CALENDAR_TAB_STOP = '[role="gridcell"][tabindex="0"], [role="gridcell"] [tabindex="0"]';

/**
 * Gives the day, the month or the year of `calendar` that has the tab stop. It is the element that
 * the date picker pattern names for the focus at the open. A calendar part gives it to
 * `usePickerFocusTarget`.
 */
export function getCalendarTabStop(calendar: Element | null | undefined): HTMLElement | null {
  return calendar?.querySelector<HTMLElement>(CALENDAR_TAB_STOP) ?? null;
}

// A part that mounts later still has its place in the document, so the registration order of the
// parts does not decide.
function getFirstInDocument(elements: (Element | null | undefined)[]) {
  let first: Element | undefined;
  for (const element of elements) {
    if (
      element &&
      (!first ||
        first.compareDocumentPosition(element) &
          ownerWindow(first).Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      first = element;
    }
  }
  return first;
}

/**
 * The popup part of a picker calls it in `setup`, and gives the result to `Popover.Popup` as
 * `initialFocus`. The focus manager asks for the element at each open, also of a popup that stays
 * mounted. The default is the first element, in the order of the document, that a target gives. A
 * part of the popup registers its target with `usePickerFocusTarget`. Without that default, the
 * focus manager would take the first tabbable element, which is a navigation button. A popup with
 * no element from a target keeps the default of `Popover.Popup`.
 * @param initialFocus The `initialFocus` prop of the part. A value of the consumer replaces the
 * default, also `false`. `true`, `null` and no value ask for the default.
 */
export function usePickerInitialFocus(
  initialFocus: () => FocusOption | undefined,
): ComputedRef<FocusOption> {
  const store = usePopoverRootContext();
  const targets = new Set<PickerFocusTarget>();
  provide(PickerFocusTargetContext, targets);

  const popupDefault = createDefaultInitialFocus(store.context.popupRef);
  const pickerDefault = (interactionType: InteractionType) =>
    getFirstInDocument([...targets].map((target) => target())) ?? popupDefault(interactionType);

  // `true` and `null` ask for the default behavior, and the default of a picker is its target. The
  // same holds for the result of a function.
  return computed(() => {
    const option = initialFocus();
    if (typeof option === 'function') {
      return (interactionType: InteractionType) => {
        const result = option(interactionType);
        return result === true || result === null ? pickerDefault(interactionType) : result;
      };
    }
    const value = unref(option);
    return value === undefined || value === null || value === true ? pickerDefault : value;
  });
}

/**
 * A part of the popup that shows the choices of a picker, such as the calendar, calls it in
 * `setup`. `target` gives the element that the pattern names: the selected day, or else the first
 * day that the user can pick. It gives `null` while the part has no such element. A popup can have
 * more than one such part, such as the list, the columns and the clock of a time picker. The focus
 * goes to the first element in the document that a target gives.
 */
export function usePickerFocusTarget(target: PickerFocusTarget): void {
  const targets = inject(PickerFocusTargetContext, null);
  if (!targets) {
    return;
  }
  targets.add(target);
  onBeforeUnmount(() => {
    targets.delete(target);
  });
}
