import type { Ref } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, closest } from '../../common/shadowDom';
import { useFocusOnOpen } from '../../internals/date-time/picker/usePickerPopup';
import type { PickerPopup } from '../../internals/date-time/picker/usePickerPopup';

/**
 * Gives the focus to the selected item of a list or a column each time that the popup opens, or to
 * its first item that is not disabled. A popup that stays mounted keeps the tab stop where the user
 * left it, and a composite cannot move the tab stop while the popup is hidden. The first list or
 * column of the popup takes the focus, and a later one finds the focus in a listbox and leaves it.
 */
export function useFocusItemOnOpen(
  popup: Pick<PickerPopup, 'open'>,
  element: Readonly<Ref<HTMLElement | null>>,
) {
  useFocusOnOpen(popup, () => {
    const root = element.value;
    if (root === null || closest(activeElement(ownerDocument(root)), '[role="listbox"]')) {
      return;
    }
    const options = [...root.querySelectorAll<HTMLElement>('[role="option"]')].filter(
      (option) => option.getAttribute('aria-disabled') !== 'true',
    );
    (
      options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0]
    )?.focus();
  });
}
