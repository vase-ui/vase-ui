import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useFocusOnOpen } from '../../internals/date-time/picker/usePickerPopup';
import type { PickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { usePopoverRootContext } from '../../popover/root/PopoverRootContext';

/**
 * The option of a list or of a column that takes the focus: the selected option, or else the first
 * option that is not disabled.
 */
export function findOptionToFocus(root: HTMLElement | null | undefined): HTMLElement | undefined {
  const options = [...(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  const enabled = options.filter((option) => option.getAttribute('aria-disabled') !== 'true');
  return enabled.find((option) => option.getAttribute('aria-selected') === 'true') ?? enabled[0];
}

/**
 * Gives the focus to `target` each time that the popup opens, unless the focus is already in the
 * popup. A popup that stays mounted keeps the tab stop of a list where the user left it, and a
 * composite cannot move the tab stop while the popup is hidden. The first part of the popup that
 * sets the time thus takes the focus, and each later part finds the focus in the popup and leaves
 * it.
 */
export function useFocusPartOnOpen(
  popup: Pick<PickerPopup, 'open'>,
  target: () => HTMLElement | null | undefined,
) {
  const store = usePopoverRootContext();
  useFocusOnOpen(popup, () => {
    const element = target();
    if (!element) {
      return;
    }
    const popupElement = store.select('popupElement');
    if (popupElement && contains(popupElement, activeElement(ownerDocument(element)))) {
      return;
    }
    element.focus();
  });
}
