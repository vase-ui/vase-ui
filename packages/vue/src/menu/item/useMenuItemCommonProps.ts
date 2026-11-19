import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { platform } from '../../common/platform';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { REASONS } from '../../internals/reasons';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { isReleaseAtPressPoint } from '../../utils/popups/isReleaseAtPressPoint';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';

function preventMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

export interface UseMenuItemCommonPropsParameters {
  closeOnClick: MaybeRefOrGetter<boolean>;
  highlighted: MaybeRefOrGetter<boolean>;
  id: MaybeRefOrGetter<string | undefined>;
  store: MenuStore<any>;
  typingRef?: Readonly<Ref<boolean>> | undefined;
  isSubmenuTrigger?: boolean | undefined;
}

export function useMenuItemCommonProps(
  element: Readonly<Ref<HTMLElement | null>>,
  params: UseMenuItemCommonPropsParameters,
): ComputedRef<Record<string, unknown>> {
  const { store, typingRef = store.context.typingRef, isSubmenuTrigger } = params;

  const rootContext = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext(true);

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const listStore =
    isSubmenuTrigger && rootContext.parent.type === 'menu'
      ? rootContext.parent.store
      : rootContext.store;

  const isContextMenu = contextMenuContext !== undefined;

  const listeners = {
    // Real focus stays on the input or list that owns virtual navigation.
    onMousedown: virtualFocus ? preventMouseDownDefault : undefined,
    onKeydown(event: KeyboardEvent) {
      if (event.key === ' ' && typingRef?.value) {
        event.preventDefault();
      }
    },
    onMousemove(event: MouseEvent) {
      const nodeId = listStore.select('floatingNodeId');
      if (!nodeId) {
        return;
      }

      // Inform the floating tree that a menu item within this menu was hovered/moved over
      // so unrelated descendant submenus can be closed.
      store.select('floatingTreeRoot').events.emit('itemhover', {
        nodeId,
        target: event.currentTarget,
      });
    },
    onClick(event: MouseEvent) {
      if (toValue(params.closeOnClick)) {
        store
          .select('floatingTreeRoot')
          .events.emit('close', { domEvent: event, reason: REASONS.itemPress });
      }
    },
    onMouseup(event: MouseEvent) {
      if (contextMenuContext) {
        const initialCursorPoint = contextMenuContext.initialCursorPointRef.value;
        contextMenuContext.initialCursorPointRef.value = null;
        // The popup opens at the pointer, so an item can start a few pixels from it (`VUE-84`).
        if (
          initialCursorPoint &&
          isReleaseAtPressPoint(
            { clientX: initialCursorPoint.x, clientY: initialCursorPoint.y },
            event,
          )
        ) {
          return;
        }

        // On non-macOS platforms, this mouseup belongs to the right-click gesture
        // that opened the context menu, so it must not activate an item.
        if (!platform.os.mac && event.button === 2) {
          return;
        }
      }

      const item = element.value;
      const press = store.context.triggerPressRef.value;
      if (
        item &&
        !isSubmenuTrigger &&
        store.context.allowMouseUpTriggerRef.value &&
        (!isContextMenu || event.button === 2) &&
        // The open can put an item under a pointer that does not move (`VUE-84`).
        !(press && isReleaseAtPressPoint(press, event))
      ) {
        // Drag release has no mousedown on this item. Focus it before activation so
        // arrow navigation continues from it when the menu stays open.
        if (!virtualFocus) {
          item.focus({ preventScroll: true });
        }
        // The press started on the trigger and was released over the item, so the item
        // needs a synthetic click. Its `closeOnClick` preference still applies.
        // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
        // the menu and its focus manager handle it as a pointer press.
        dispatchClickWithModifiers(item, event, {
          detail: 1,
          pointerType: 'mouse',
        });
      }
    },
  };

  return computed(() => {
    const highlighted = toValue(params.highlighted);
    return {
      id: toValue(params.id),
      role: 'menuitem',
      // `-1` rather than omitting it, which leaves links and buttons in the tab order.
      tabindex: !virtualFocus && store.select('highlightedWhileOpen', highlighted) ? 0 : -1,
      'aria-selected': listStore.select('webkitAriaSelected', highlighted),
      ...listeners,
    };
  });
}
