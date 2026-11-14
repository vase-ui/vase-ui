import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { platform } from '../../common/platform';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';
import type { UseMenuItemMetadata } from './useMenuItem';

function preventMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

export interface UseMenuItemCommonPropsParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: MaybeRefOrGetter<boolean>;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: MaybeRefOrGetter<boolean>;
  /**
   * The id of the menu item.
   */
  id: MaybeRefOrGetter<string | undefined>;
  /**
   * The node id of the menu positioner.
   */
  nodeId: MaybeRefOrGetter<string | undefined>;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   */
  typingRef?: Readonly<Ref<boolean>> | undefined;
  /**
   * The element of the item.
   */
  itemElement: Readonly<Ref<HTMLElement | null>>;
  /**
   * Metadata for checking item type before triggering click.
   */
  itemMetadata: UseMenuItemMetadata;
}

/**
 * Returns common props shared by all menu item types.
 * This composable extracts the shared logic for id, role, tabindex, and interaction handlers.
 * Call it in `setup`.
 */
export function useMenuItemCommonProps(
  params: UseMenuItemCommonPropsParameters,
): ComputedRef<Omit<HTMLProps, 'ref'>> {
  const { closeOnClick, highlighted, id, nodeId, store, typingRef, itemElement, itemMetadata } =
    params;

  const rootContext = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext(true);

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  const isSubmenuTrigger = itemMetadata.type === 'submenu-trigger';
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const selectionStore =
    isSubmenuTrigger && rootContext.parent.type === 'menu'
      ? rootContext.parent.store
      : rootContext.store;

  const isContextMenu = contextMenuContext !== undefined;

  return computed(() => {
    const isHighlighted = toValue(highlighted);

    return {
      id: toValue(id),
      role: 'menuitem',
      // `-1` rather than omitting it, which leaves links and buttons in the tab order.
      tabindex: !virtualFocus && store.select('highlightedWhileOpen', isHighlighted) ? 0 : -1,
      'aria-selected': selectionStore.select('webkitAriaSelected', isHighlighted),
      // Real focus stays on the input or list that owns virtual navigation.
      onMousedown: virtualFocus ? preventMouseDownDefault : undefined,
      onKeydown(event: KeyboardEvent) {
        if (event.key === ' ' && typingRef?.value) {
          event.preventDefault();
        }
      },
      onMousemove(event: MouseEvent) {
        const currentNodeId = toValue(nodeId);
        if (!currentNodeId) {
          return;
        }

        // Inform the floating tree that a menu item within this menu was hovered/moved over
        // so unrelated descendant submenus can be closed.
        store.select('floatingTreeRoot').events.emit('itemhover', {
          nodeId: currentNodeId,
          target: event.currentTarget,
        });
      },
      onClick(event: MouseEvent) {
        if (toValue(closeOnClick)) {
          store
            .select('floatingTreeRoot')
            .events.emit('close', { domEvent: event, reason: REASONS.itemPress });
        }
      },
      onMouseup(event: MouseEvent) {
        if (contextMenuContext) {
          const initialCursorPoint = contextMenuContext.initialCursorPointRef.value;
          contextMenuContext.initialCursorPointRef.value = null;
          if (
            isContextMenu &&
            initialCursorPoint &&
            Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
            Math.abs(event.clientY - initialCursorPoint.y) <= 1
          ) {
            return;
          }

          // On non-macOS platforms, this mouseup belongs to the right-click gesture
          // that opened the context menu, so it must not activate an item.
          if (isContextMenu && !platform.os.mac && event.button === 2) {
            return;
          }
        }

        const element = itemElement.value;
        if (
          element &&
          itemMetadata.type === 'regular-item' &&
          store.context.allowMouseUpTriggerRef.value &&
          (!isContextMenu || event.button === 2)
        ) {
          // Drag release has no mousedown on this item. Focus it before activation so
          // arrow navigation continues from it when the menu stays open.
          if (!virtualFocus) {
            element.focus({ preventScroll: true });
          }
          // The press started on the trigger and was released over the item, so the item
          // needs a synthetic click. Its `closeOnClick` preference still applies.
          // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
          // MenuRoot and FloatingFocusManager don't treat it as a keyboard activation.
          dispatchClickWithModifiers(element, event, {
            detail: 1,
            pointerType: 'mouse',
          });
        }
      },
    };
  });
}
