import { computed, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { NOOP } from '../../common/empty';
import { useEnhancedClickHandler } from '../../common/useEnhancedClickHandler';
import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import type { UseFilterDropdownItemParameters } from '../../filter-dropdown/item/useFilterDropdownItem';
import { useFilterContextForList } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { VaseUIEvent } from '../../internals/types';
import { isVirtualPointerEvent } from '../../utils/popups/event';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuFilterSubmenuTrigger } from './MenuFilterContext';

/**
 * Registers a submenu trigger with the filter of the parent menu and adapts it to a filterable
 * submenu: the trigger is in its own submenu root, but it is an item of the list of the parent.
 *
 * Call it in `setup` of the trigger.
 */
export function useMenuFilterSubmenuTrigger(
  params: UseFilterDropdownItemParameters,
): MenuFilterSubmenuTrigger {
  // `virtualFocus` is set only by a filterable submenu root, so it tells this trigger whether the
  // submenu it opens renders a `role="dialog"` popup or a plain `role="menu"` one. The documented
  // plain-submenu recipe relies on the latter.
  const { store, parent, virtualFocus } = useMenuRootContext();

  const open = computed(() => store.select('open'));
  const mounted = computed(() => store.select('mounted'));

  // The submenu root of the provider hides the dropdown of the parent from the trigger, but the
  // trigger belongs to the list that it opens from, which is the list of the parent menu.
  const parentListRef = parent.type === 'menu' ? parent.store.context.itemDomElements : null;
  const parentContext = useFilterContextForList(parentListRef);

  const { visible, ref, setHiddenText } = useFilterDropdownItem({
    ...params,
    context: parentContext,
    retainGroup: mounted,
  });

  // Filtering the trigger out removes its element and leaves its submenu open with no anchor.
  watch([visible, open], () => {
    if (visible.value || !open.value) {
      return;
    }
    store.setOpen(false, createChangeEventDetails(REASONS.none));
  });

  const clickProps = useEnhancedClickHandler((event, interactionType) => {
    if (
      event.type === 'click' &&
      store.select('open') &&
      (interactionType === 'keyboard' ||
        (interactionType === 'mouse' &&
          store.select('lastOpenChangeReason') === REASONS.triggerPress))
    ) {
      store.context.virtualFocusRef?.value?.focus({ preventScroll: true });
    }
  });

  const props: HTMLAttributes = {
    // Left out and not `undefined`, which would clear the `'menu'` that the root puts on every
    // trigger.
    ...(virtualFocus ? { 'aria-haspopup': 'dialog' as const } : undefined),
    ...clickProps,
    onPointerdown(event: PointerEvent) {
      clickProps.onPointerdown(event);
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onFocusin(event: FocusEvent) {
      // A plain parent menu moves the focus to the item that the pointer crosses. While the
      // submenu of this trigger is open and its input had the focus, hand the focus straight back
      // so that crossing the trigger does not interrupt the typing.
      const focusOwner = store.context.virtualFocusRef?.value;
      if (focusOwner && store.select('open') && event.relatedTarget === focusOwner) {
        (event as VaseUIEvent<FocusEvent>).preventVaseUIHandler();
        focusOwner.focus({ preventScroll: true });
      }
    },
  };

  if (parentContext === null) {
    // A plain parent menu moves the focus across its items and never filters them.
    return { visible: computed(() => true), ref: NOOP, setHiddenText: NOOP, props };
  }

  return {
    visible: computed(() => visible.value || mounted.value),
    ref,
    setHiddenText,
    props,
  };
}
