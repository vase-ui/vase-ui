import { computed, inject, onScopeDispose, provide } from 'vue';
import type { ComputedRef } from 'vue';
import { ownerWindow } from '../../../common/owner';
import { injectPopoverRoot } from '../../../popover/root';
import type { FocusTarget } from '../../../popup/focus';
import type { InteractionType } from '../../../popup/root';
import { useKeepAliveState } from '../../useKeepAliveState';
import { RegisterPickerFocusTarget } from './PickerControlContext';
import type { PickerFocusTarget } from './PickerControlContext';

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
  const { root } = injectPopoverRoot('Root');
  const open = computed(() => root.open);

  function openByKey(event: KeyboardEvent) {
    if (open.value) {
      return;
    }
    root.request(true, 'trigger-press', event, root.triggers[0]?.element);
  }

  function closeAfterSelection(event: Event) {
    root.request(false, 'imperative-action', event);
  }

  return { open, openByKey, closeAfterSelection };
}

/**
 * Gives the first of `elements` in the order of the document. A part that mounts later still has
 * its place in the document, so the order of the registrations does not decide. An element that
 * is not in the document cannot take focus.
 */
export function getFirstInDocument<T extends Element>(
  elements: (T | null | undefined)[],
): T | undefined {
  let first: T | undefined;
  for (const element of elements) {
    if (
      element?.isConnected &&
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
 * Gives `Popover.Popup` the initial focus for a picker. By default it uses the first connected
 * target in document order. Without a target it keeps the default of `Popover.Popup`.
 * @param initialFocus The `initialFocus` prop of the part. A value of the consumer replaces the
 * default, also `false`. `true`, `null` and no value ask for the default.
 */
export function usePickerInitialFocus(
  initialFocus: () => FocusTarget | undefined,
): ComputedRef<FocusTarget> {
  const targets = new Set<PickerFocusTarget>();
  provide(RegisterPickerFocusTarget, (target) => {
    const { isHeld } = useKeepAliveState();
    const getElement = () => (isHeld.value ? null : target());
    targets.add(getElement);
    onScopeDispose(() => targets.delete(getElement));
  });

  // `true` asks for the default of the popover.
  const pickerDefault = () =>
    (getFirstInDocument(Array.from(targets, (target) => target())) as HTMLElement | undefined) ??
    true;

  // `true` and `null` ask for the default behavior, and the default of a picker is its target. The
  // same holds for the result of a function.
  return computed(() => {
    const option = initialFocus();
    if (typeof option === 'function') {
      return (interactionType: InteractionType) => {
        const result = option(interactionType);
        return result === true || result === null ? pickerDefault() : result;
      };
    }
    return option === undefined || option === null || option === true ? pickerDefault : option;
  });
}

/**
 * A time picker list or column registers its focus target in `setup`. The getter returns the
 * selected enabled option or the first enabled option. A held part gives no target.
 */
export function usePickerFocusTarget(target: PickerFocusTarget): void {
  inject(RegisterPickerFocusTarget, null)?.(target);
}
