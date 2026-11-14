import { watch } from 'vue';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { useFilterDropdownList } from '../../filter-dropdown/list/FilterDropdownList';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../../filter-dropdown/root/FilterDropdownRootContext';
import { refocusOwner } from '../../filter-dropdown/utils/refocusOwner';
import { useCompositeListContext } from '../../internals/composite/list/CompositeListContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import { mergeProps } from '../../merge-props';
import { isMainOrientationKey } from '../../utils/popups/interactions/useListNavigation';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuFilterList, MenuFilterListParameters } from './MenuFilterContext';
import { moveHighlightFrom } from './moveHighlightFrom';
import { useMenuFilterKeyDown } from './useMenuFilterKeyDown';

/**
 * Gives the list of a filterable menu the role `menu` while the popup is a dialog that holds the
 * input, and forwards the keys that land on it to the input. `Menu.List` calls it in `setup`.
 */
export function useFilterList(params: MenuFilterListParameters): MenuFilterList {
  const menuContext = useMenuRootContext();
  const { store, orientation, loopFocus, allowEscape } = menuContext;
  const direction = useDirection();
  const { onItemsChange, focusOwnerRef, triggerId } = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const compositeList = useCompositeListContext();

  const value = useFilterDropdownValueContext();
  const handleInputKeydown = useMenuFilterKeyDown(menuContext, () => value.value !== '');
  const list = useFilterDropdownList({ id: params.id });

  function handleKeydown(event: KeyboardEvent) {
    const owner = focusOwnerRef.value;
    const target = getTarget(event) as Element;
    const ownerFocused = owner != null && activeElement(ownerDocument(owner)) === owner;
    const fromNestedPopup = !contains(event.currentTarget as Element, target);
    // Keys the input forwards to its highlighted item arrive here while the input still holds
    // focus, and the keys of a nested popup that is not teleported bubble from outside the list.
    if (owner == null || ownerFocused || fromNestedPopup) {
      if (
        event.which !== 229 &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        isMainOrientationKey(event.key, orientation.value)
      ) {
        // Keep main-axis keys from reaching this popup's own list navigation, which lost its
        // place while the nested popup held focus. A plain submenu that closes on the key hands
        // focus back and lets it through, so move on from its trigger as a plain parent would.
        event.stopPropagation();
        const trigger = fromNestedPopup && ownerFocused ? getNestedPopupTrigger(target) : undefined;
        if (trigger) {
          moveHighlightFrom(store, trigger, event, {
            orientation: orientation.value,
            rtl: direction.value === 'rtl',
            loopFocus: loopFocus.value,
            allowEscape: allowEscape.value,
          });
        }
      }
      return;
    }

    // An item that already acted on the key (Enter and Space activate it) keeps it.
    if (event.defaultPrevented) {
      return;
    }

    // Real focus can land inside the list while the input still owns the keyboard: a scrollbar
    // press focuses the list itself, and a screen reader following `aria-activedescendant`
    // focuses the highlighted item. Hand focus back and route the key as the input would; a
    // typing key's default action follows the moved focus into the input.
    refocusOwner(owner);
    handleInputKeydown(event);
  }

  // The item whose `aria-controls` popup holds `target`. The popup shares the target's root,
  // which is a shadow root when it's portaled into one.
  function getNestedPopupTrigger(target: Element) {
    const root = target.getRootNode() as Document | ShadowRoot;
    return listRef.value.find((item): item is HTMLElement => {
      const popupId = item?.getAttribute('aria-controls');
      return (
        popupId != null && isHTMLElement(item) && contains(root.getElementById(popupId), target)
      );
    });
  }

  // `null` distinguishes the initial registration from a list emptied by filtering.
  let previousItems: readonly (HTMLElement | null)[] | null = null;

  // The composite list publishes its map before it calls `onMapChange`, so the positioner reports
  // the highlight against the settled registry only after the items change has been resolved here.
  function handleItemMapChange() {
    const items = [...listRef.value];
    const changed =
      previousItems === null ||
      previousItems.length !== items.length ||
      items.some((item, index) => item !== previousItems![index]);

    if (changed && previousItems !== null) {
      onItemsChange(previousItems);
    }
    previousItems = items;
  }

  // The positioner provides the composite list that holds the items.
  if (compositeList) {
    watch(compositeList.map, handleItemMapChange, { flush: 'sync' });
  }

  return {
    props: (attrs) =>
      list.props(
        mergeProps<'div'>(
          {
            role: 'menu',
            'aria-labelledby': resolvePopupLabel(attrs, null, triggerId.value ?? null),
            'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
            onKeydown: handleKeydown,
          },
          attrs,
        ),
      ),
  };
}
