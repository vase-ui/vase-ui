import {
  computed,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import { useMenubarContext } from '../../internals/menubar-context/MenubarContext';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { mergeProps } from '../../merge-props';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { usePopupRootWithPopupId } from '../../utils/popups/popupRoot';
import {
  FOCUSABLE_POPUP_PROPS,
  usePopupInteractionProps,
} from '../../utils/popups/popupStoreUtils';
import {
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import { MenuStore } from '../store/MenuStore';
import type { MenuCommittedOpenState } from '../store/MenuStore';
import type {
  MenuParent,
  MenuRootChangeEventDetails,
  MenuRootHighlightEventDetails,
  MenuRootProps,
} from './MenuRoot.vue';
import { MenuRootContext, useMenuRootContext } from './MenuRootContext';

export interface UseMenuRootOptions {
  /**
   * Emits `openChange`, and then `update:open` when `details.isCanceled` is `false`.
   */
  onOpenChange: (open: boolean, eventDetails: MenuRootChangeEventDetails) => void;
  /**
   * Emits `openChangeComplete`.
   */
  onOpenChangeComplete: (open: boolean) => void;
  /**
   * Emits `itemHighlighted`.
   */
  onItemHighlighted: (
    highlightedItem: HTMLElement | undefined,
    eventDetails: MenuRootHighlightEventDetails,
  ) => void;
  /**
   * Marks this root as a submenu of the enclosing menu.
   */
  isSubmenu?: boolean | undefined;
  /**
   * Whether real focus stays on an element inside the popup, such as a filter input. The root then
   * keeps the highlighted element in the store.
   */
  virtualFocus?: boolean | undefined;
  /**
   * The element that holds real focus while `virtualFocus` is set.
   */
  virtualFocusRef?: Readonly<Ref<HTMLElement | null>> | undefined;
  /**
   * Whether the arrow keys can step from either end of the list back to the element that holds
   * real focus. It is a value, a ref or a getter.
   * @default true
   */
  allowEscape?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Does the work of a menu root: it makes the store, reads the parent of the menu, provides the
 * context and the popup tree, and calls the interaction composables. `Menu.Root` calls it in
 * `setup`.
 *
 * @param props The props of the root. A submenu root gives fewer props, because each prop is
 * optional.
 * @param options What the part gives: its emit functions and the internal props of Base UI.
 * @returns The payload of the active trigger and the actions that the part exposes.
 */
export function useMenuRoot<Payload>(props: MenuRootProps<Payload>, options: UseMenuRootOptions) {
  const { isSubmenu = false, virtualFocus = false } = options;

  const contextMenuContext = useContextMenuRootContext(true);
  const parentMenuRootContext = useMenuRootContext(true);
  const menubarContext = useMenubarContext(true);

  const enclosingMenuStore = parentMenuRootContext?.store;
  const parentVirtualFocus = parentMenuRootContext?.virtualFocus ?? false;

  // A component keeps its provider chain, so the parent does not change.
  let parentFromContext: MenuParent = { type: undefined };
  if (isSubmenu && enclosingMenuStore) {
    parentFromContext = { type: 'menu', store: enclosingMenuStore };
  } else if (menubarContext) {
    parentFromContext = { type: 'menubar', context: menubarContext };
  } else if (contextMenuContext && !enclosingMenuStore) {
    // Ensure this is not a Menu nested inside ContextMenu.Trigger.
    // ContextMenu parentContext is always undefined as ContextMenu.Root provides `undefined` as the
    // menu root context.
    parentFromContext = { type: 'context-menu', context: contextMenuContext };
  }

  const rootId = useVaseUiId();
  const generatedPopupId = useVaseUiId();
  const renderedPopupId = shallowRef<string | undefined>(undefined);

  // A registered `''` means the popup rendered with an explicitly empty id, so nothing may point
  // at the generated fallback.
  const defaultPopupId = computed(
    () => (renderedPopupId.value ?? generatedPopupId.value) || undefined,
  );

  const floatingParentNodeIdFromContext = useFloatingParentNodeId();

  const { store, open, payload, actions } = usePopupRootWithPopupId(
    props,
    (initialState, initialPopupId) => {
      const menuStore = new MenuStore<Payload>(
        {
          ...initialState,
          parent: parentFromContext,
          disabled: props.disabled ?? false,
          highlightItemOnHover: props.highlightItemOnHover ?? true,
          modal: parentFromContext.type === undefined ? props.modal : undefined,
          rootId: rootId.value,
        },
        initialPopupId,
      );
      menuStore.context.virtualFocusRef = options.virtualFocusRef;
      return menuStore;
    },
    defaultPopupId,
    {
      name: 'Menu',
      handle: () => props.handle,
      onOpenChange: options.onOpenChange,
      onOpenChangeComplete: options.onOpenChangeComplete,
    },
  );

  const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
  const floatingNodeIdFromContext = useFloatingNodeId(floatingTreeRoot);

  const parent = computed(() => store.select('parent'));
  const nested = computed(() => store.select('floatingParentNodeId') != null);

  // A Boolean prop with the default `true` cannot tell an absent prop from `true`, so the check
  // runs only for `false`.
  if (process.env.NODE_ENV !== 'production') {
    watch(
      [() => parent.value.type, () => props.modal],
      ([parentType, modal]) => {
        if (parentType !== undefined && modal === false) {
          warn(
            'The `modal` prop of <Menu.Root> is `false`, but the menu is in a menubar, a context menu or another menu.',
            'Only a menu with no parent can be modal, so the prop has no effect.',
            'Remove the prop from the nested menu.',
          );
        }
      },
      { immediate: true },
    );
  }

  watch(
    () => ({
      disabled: props.disabled ?? false,
      highlightItemOnHover: props.highlightItemOnHover ?? true,
      modal: parent.value.type === undefined ? props.modal : undefined,
      rootId: rootId.value,
    }),
    (values) => store.update(values),
  );

  watch(
    [floatingParentNodeIdFromContext, () => store.select('activeTriggerElement')],
    ([parentNodeId, activeTriggerElement]) => {
      if (contextMenuContext && !parentMenuRootContext) {
        // This is a context menu root.
        // It doesn't support detached triggers yet, so we have to sync the parent context manually.
        store.update({
          parent: { type: 'context-menu', context: contextMenuContext },
          floatingNodeId: floatingNodeIdFromContext,
          floatingParentNodeId: parentNodeId,
        });
      } else if (parentMenuRootContext || !activeTriggerElement) {
        // Without an active trigger, the root must supply its own tree IDs.
        store.update({
          floatingNodeId: floatingNodeIdFromContext,
          floatingParentNodeId: parentNodeId,
        });
      }
    },
    { immediate: true },
  );

  let allowOutsidePressDismissal = toRaw(store.state).parent.type !== 'context-menu';
  const allowOutsidePressDismissalTimeout = useTimeout();

  function followOpenState() {
    const isOpen = open.value;
    if (!isOpen) {
      store.context.lastOpenChangeEvent = undefined;
    }

    if (parent.value.type !== 'context-menu') {
      return;
    }

    if (!isOpen) {
      allowOutsidePressDismissalTimeout.clear();
      allowOutsidePressDismissal = false;
      return;
    }

    // With `mousedown` outside press events and long press touch input, there
    // needs to be a grace period after opening to ensure the dismissal event
    // doesn't fire immediately after open.
    allowOutsidePressDismissalTimeout.start(500, () => {
      allowOutsidePressDismissal = true;
    });
  }
  onMounted(followOpenState);
  watch([open, () => parent.value.type], followOpenState);

  onScopeDispose(() => store.context.allowTouchToCloseTimeout.clear());

  watch([open, () => store.select('hoverEnabled')], ([isOpen, hoverEnabled]) => {
    if (!isOpen && !hoverEnabled) {
      store.set('hoverEnabled', true);
    }
  });

  // Repeated open requests are compared against what this root last rendered. The watcher has the
  // default flush, so the value changes in the flush that renders the change.
  let committedOpenState = readOpenState();
  function readOpenState(): MenuCommittedOpenState {
    return {
      open: open.value,
      activeTriggerElement: store.select('activeTriggerElement'),
      openChangeReason: store.select('lastOpenChangeReason'),
    };
  }
  watch(readOpenState, (state) => {
    committedOpenState = state;
  });

  // Open changes are run only while this root is mounted. A request made before it mounts, such as
  // `handle.open()` from the `onMounted` hook of a child, or after it unmounts, is dropped.
  onMounted(() => {
    store.context.getCommittedOpenState = () => committedOpenState;
  });
  onScopeDispose(() => {
    store.context.getCommittedOpenState = undefined;
  });

  watch(
    [parent, () => store.select('positionerElement')] as const,
    ([currentParent, positionerElement], _previous, onCleanup) => {
      if (currentParent.type !== 'context-menu') {
        return;
      }

      const context = currentParent.context;
      context.positionerRef.value = positionerElement;
      context.actionsRef.value = { setOpen: store.setOpen };
      onCleanup(() => {
        context.positionerRef.value = null;
        context.actionsRef.value = null;
      });
    },
    { immediate: true },
  );

  const dismiss = useDismiss(store, {
    enabled: () => !store.select('disabled'),
    bubbles: () => ({
      escapeKey: (props.closeParentOnEsc ?? false) && parent.value.type === 'menu',
    }),
    outsidePress() {
      if (
        toRaw(store.state).parent.type !== 'context-menu' ||
        store.context.lastOpenChangeEvent?.type === 'contextmenu'
      ) {
        return true;
      }

      return allowOutsidePressDismissal;
    },
    externalTree: () => (nested.value ? floatingTreeRoot.value : undefined),
  });

  let lastHighlightIndex = -1;

  // Reports the item at `activeIndex` after the DOM update of a change of the index. A part calls it
  // again from the context when the item registry settles, since an index can come to point at a
  // different element while its value stays the same.
  function syncHighlightedItem() {
    const index = toRaw(store.state).activeIndex;
    const item =
      index === null ? undefined : (store.context.itemDomElements.value[index] ?? undefined);
    // An item removed in this update stays registered until the list sorts, which calls back
    // here with the settled registry.
    if (item?.isConnected === false) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `item` is defined only when `index` is not `null`.
    const itemIndex = item === undefined ? -1 : index!;
    if (lastHighlightIndex === itemIndex && store.context.reportedItem === item) {
      return;
    }

    lastHighlightIndex = itemIndex;
    store.context.reportedItem = item;
    // Only virtual focus renders from the highlighted element. Publishing it in every menu would
    // notify each item on every highlight change.
    if (virtualFocus) {
      store.set('highlightedItem', item);
    }
    // The tag left by the write that produced this value.
    const { highlightReason, highlightEvent } = store.context;
    store.context.highlightReason = REASONS.none;
    store.context.highlightEvent = undefined;
    options.onItemHighlighted(
      item,
      createGenericEventDetails(highlightReason, highlightEvent, {
        label:
          item === undefined ? undefined : (store.context.itemLabels.value[itemIndex] ?? undefined),
      }),
    );
  }
  watch(() => store.select('activeIndex'), syncHighlightedItem, { flush: 'post' });

  function allowMouseEnter() {
    store.set('allowMouseEnter', true);
  }

  const popupListeners = {
    onMousemove() {
      store.set('allowMouseEnter', true);
      if (toRaw(store.state).parent.type === 'menu') {
        store.set('hoverEnabled', false);
      }
    },
    onClick() {
      if (store.select('hoverEnabled')) {
        store.set('hoverEnabled', false);
      }
    },
    onKeydown(event: KeyboardEvent) {
      // The Menubar's CompositeRoot captures keyboard events via event delegation. This works well
      // when Menu.Root is nested inside Menubar, but with detached triggers we need to manually
      // forward the event to the CompositeRoot.
      const relay = store.select('keyboardEventRelay');
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- `cancelBubble` is the only read that tells that a handler stopped the event.
      if (relay && !event.cancelBubble) {
        relay(event);
      }
    },
  };

  usePopupInteractionProps(store, () => ({
    activeTriggerProps: mergeProps(
      dismiss.reference,
      { onMousemove: allowMouseEnter },
      {
        'aria-haspopup': 'menu',
        'aria-expanded': open.value,
      },
    ),
    inactiveTriggerProps: mergeProps(dismiss.trigger, {
      'aria-haspopup': 'menu',
      'aria-expanded': false,
    }),
    popupProps: mergeProps(FOCUSABLE_POPUP_PROPS, popupListeners, dismiss.floating),
  }));

  const context: MenuRootContext<Payload> = {
    store,
    parent: parentFromContext,
    orientation: computed(() => props.orientation ?? 'vertical'),
    loopFocus: computed(() => props.loopFocus ?? true),
    allowEscape: computed(() => toValue(options.allowEscape) ?? true),
    generatedPopupId: generatedPopupId.value,
    setRenderedPopupId(id) {
      renderedPopupId.value = id;
    },
    virtualFocus,
    parentVirtualFocus,
    syncHighlightedItem,
  };
  provide(MenuRootContext, context);

  if (parentFromContext.type === undefined || parentFromContext.type === 'context-menu') {
    // Set up a tree to provide the context to nested menus. A detached trigger can give the store
    // another tree.
    provideFloatingTree(floatingTreeRoot);
  }

  return { payload, actions };
}
