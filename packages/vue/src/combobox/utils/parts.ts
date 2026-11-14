import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { Side } from '../../internals/useAnchorPositioning';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';

/**
 * The popup side has a meaning only while the positioner is mounted, because the store keeps the
 * last side after the popup unmounts.
 */
export function usePopupSide(store: ComboboxStore): ComputedRef<Side | null> {
  return computed(() =>
    store.select('mounted') && store.select('positionerElement') ? store.select('popupSide') : null,
  );
}

/**
 * Whether the filtered list has no items to show.
 */
export function useListEmpty(): ComputedRef<boolean> {
  const { filteredItems } = useComboboxDerivedItemsContext();
  return computed(() => filteredItems.value.length === 0);
}

/**
 * The arrow keys that move the chip highlight backwards and forwards, in that order.
 */
export function getChipNavigationKeys(direction: 'ltr' | 'rtl') {
  return direction === 'rtl'
    ? (['ArrowRight', 'ArrowLeft'] as const)
    : (['ArrowLeft', 'ArrowRight'] as const);
}

/**
 * The index that gets the highlight after the removal of the chip at `index`, or `undefined` for no
 * highlight.
 */
export function getIndexAfterChipRemoval(index: number, chipCount: number) {
  const nextIndex = index >= chipCount - 1 ? chipCount - 2 : index;
  return nextIndex >= 0 ? nextIndex : undefined;
}

/**
 * Selects the highlighted item with a click. The click handler of the item reads the event that
 * started the selection from `selectionEventRef`.
 */
export function clickHighlightedItem(
  store: ComboboxStore,
  activeIndex: number,
  nativeEvent: KeyboardEvent,
) {
  const listItem = store.context.listRef.value[activeIndex];

  if (listItem) {
    store.context.selectionEventRef.value = nativeEvent;
    listItem.click();
    store.context.selectionEventRef.value = null;
  }
}
