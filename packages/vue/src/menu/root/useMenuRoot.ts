import { selectors as menuSelectors, MenuStore } from '../store/MenuStore';
import { computed, onMounted, onScopeDispose, provide, toRaw, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../common/empty';
import { useTimeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import { TYPEAHEAD_RESET_MS } from '../../internals/constants';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { createGenericEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useMenubarContext } from '../../internals/menubar-context/MenubarContext';
import { REASONS } from '../../internals/reasons';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { mergeProps } from '../../merge-props';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { stopEvent } from '../../utils/popups/event';
import { dismissPopupBindings, dismissTriggerBindings, useDismissLayer } from '../../utils/popups/interactions/useDismissLayer';
import { useListNavigation } from '../../utils/popups/interactions/useListNavigation';
import { useTriggerModality } from '../../utils/popups/usePopupTrigger';
import { useTypeahead } from '../../utils/popups/interactions/useTypeahead';
import { usePopupRoot, usePopupRootSync } from '../../utils/popups/usePopupRoot';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupBindings';
import {
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import { useElementId } from '../../utils/popups/useElementId';
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
  /**
   * Whether the highlight clears when the pointer leaves an item. It is a value, a ref or a
   * getter.
   * @default true
   */
  resetOnPointerLeave?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the root is disabled in addition to its `disabled` prop. It is a value, a ref or a
   * getter. A filterable submenu follows the state of its parent menu.
   * @default false
   */
  disabled?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Does the work of a menu root: it makes the store, reads the parent of the menu, provides the
 * context and the popup tree, and calls the interaction composables. `Menu.Root` calls it in
 * `setup`.
 *
 * @param props The props of the root. A submenu root gives fewer props, because each prop is
 * optional.
 * @param options What the part gives: its emit functions and the internal props of Base UI.
 * @returns The payload of the active trigger, the actions that the part exposes, and the context
 * that the root provides. A component cannot inject what it provides, so a root that needs the
 * context takes it from here.
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

  function isDisabled() {
    return (props.disabled ?? false) || (toValue(options.disabled) ?? false);
  }

  const floatingParentNodeIdFromContext = useFloatingParentNodeId();

  const parentMenuStore = parentFromContext.type === 'menu' ? parentFromContext.store : undefined;
  const parentMenuState = parentMenuStore === undefined ? undefined : toRaw(parentMenuStore.state);
  // An initially open submenu should animate in only when the user watches it appear, i.e. when
  // its subtree mounts because the parent popup is playing its own enter transition. A parent
  // that was `defaultOpen` at page load never passes through `'starting'`, and under a
  // `keepMounted` parent the submenu mounts at page load while the parent's status is still
  // `undefined` — in both cases the submenu is page-load content that must not animate. Gated on
  // being open at mount so a closed submenu doesn't seed `instantType` it would never clear.
  const animateInitialOpen =
    (props.open ?? props.defaultOpen ?? false) && parentMenuState?.transitionStatus === 'starting';

  // Mirror an instantly-opened parent (e.g. keyboard click) so `[data-instant]` styling
  // suppresses the enter transition on both popups or neither.
  const seededInstantType = animateInitialOpen ? parentMenuState?.instantType : undefined;

  const {
    store,
    open,
    triggerId,
    trigger: activeTriggerElement,
    payload,
    transitionStatus,
    actions,
    requestOpen,
    bindParts,
  } = usePopupRoot(
    props,
    (initialState, defaultPopupId) => {
      const menuStore = new MenuStore<Payload>(
        {
          ...initialState,
          parent: parentFromContext,
          disabled: isDisabled(),
          highlightItemOnHover: props.highlightItemOnHover ?? true,
          modal: parentFromContext.type === undefined ? props.modal : undefined,
          rootId: rootId.value,
          instantType: seededInstantType,
        },
        defaultPopupId,
      );
      menuStore.context.virtualFocusRef = options.virtualFocusRef;
      return menuStore;
    },
    {
      name: 'Menu',
      handle: () => props.handle,
      onOpenChange: options.onOpenChange,
      onOpenChangeComplete: options.onOpenChangeComplete,
      animateInitialOpen,
    },
  );

  const floatingTreeRoot = computed(() => menuSelectors.floatingTreeRoot(store.state));
  const floatingNodeIdFromContext = useFloatingNodeId(floatingTreeRoot);

  const parent = computed(() => store.state.parent);
  const nested = computed(() => store.state.floatingParentNodeId != null);
  const disabled = computed(() => menuSelectors.disabled(store.state));
  const activeIndex = computed(() => store.state.activeIndex);
  const loopFocus = computed(() => props.loopFocus ?? true);
  const orientation = computed(() => props.orientation ?? 'vertical');
  const allowEscape = computed(() => toValue(options.allowEscape) ?? true);

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

  const interactionTypeProps = useTriggerModality(open, (interactionType) =>
    store.set('openMethod', interactionType),
  );
  usePopupRootSync(store, open);

  watch(
    () => ({
      disabled: isDisabled(),
      highlightItemOnHover: props.highlightItemOnHover ?? true,
      modal: parent.value.type === undefined ? props.modal : undefined,
      rootId: rootId.value,
    }),
    (values) => store.update(values),
  );

  if (seededInstantType !== undefined) {
    clearSeededInstantTypeAfterReveal();
  }

  // An inherited `instantType` is only for the initial reveal. A later controlled `open` flip
  // bypasses `setOpen`, so nothing would reset it and `[data-instant]` would wrongly suppress
  // every subsequent transition. Clear it once the enter phase settles, unless an interactive
  // open change already replaced it.
  function clearSeededInstantTypeAfterReveal() {
    const runOnceAnimationsFinish = useAnimationsFinished(store.context.popupRef);
    let abortController: AbortController | undefined;

    function clearSeededInstantType() {
      if (toRaw(store.state).instantType === seededInstantType) {
        store.set('instantType', undefined);
      }
    }

    function followReveal() {
      abortController?.abort();
      abortController = undefined;

      // A controlled close can interrupt the initial enter before the animations-finished
      // callback runs, and a closed popup schedules no new one. Nothing is left to protect once
      // closing starts, so clear now or the next reopen renders a stale `[data-instant]`.
      if (!open.value) {
        clearSeededInstantType();
        return;
      }

      if (transitionStatus.value !== undefined) {
        return;
      }

      // With no popup element there is no enter transition to protect, and
      // `useAnimationsFinished` would return without calling back. A popup that appears after the
      // reveal settles is page-load-like content.
      if (store.context.popupRef.value == null) {
        clearSeededInstantType();
        return;
      }

      abortController = new AbortController();
      runOnceAnimationsFinish(clearSeededInstantType, abortController.signal);
    }

    onMounted(followReveal);
    watch([open, transitionStatus], followReveal, { flush: 'post' });
    onScopeDispose(() => abortController?.abort());
  }

  watch(
    [floatingParentNodeIdFromContext, activeTriggerElement],
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
  const { isHeld } = useKeepAliveState();

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

    if (isHeld.value) {
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
  watch(
    isHeld,
    (held) => {
      if (!held) {
        followOpenState();
        return;
      }

      allowOutsidePressDismissalTimeout.clear();
    },
    { flush: 'sync' },
  );

  onScopeDispose(() => store.context.allowTouchToCloseTimeout.clear());

  watch([open, () => store.state.hoverEnabled], ([isOpen, hoverEnabled]) => {
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
      activeTriggerElement: activeTriggerElement.value,
      openChangeReason: store.state.openChangeReason,
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
    [parent, () => menuSelectors.positionerElement(store.state)] as const,
    ([currentParent, positionerElement], _previous, onCleanup) => {
      if (currentParent.type !== 'context-menu') {
        return;
      }

      const context = currentParent.context;
      context.positionerRef.value = positionerElement;
      context.actionsRef.value = { setOpen: requestOpen };
      onCleanup(() => {
        context.positionerRef.value = null;
        context.actionsRef.value = null;
      });
    },
    { immediate: true },
  );

  const dismiss = useDismissLayer(store, {
    enabled: () => !disabled.value,
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

  const direction = useDirection();

  const listNavigation = useListNavigation(store, {
    enabled: () => !disabled.value,
    listRef: store.context.itemDomElements,
    activeIndex,
    virtual: virtualFocus,
    nested: () =>
      parent.value.type === 'menubar' || (!virtualFocus && parent.value.type !== undefined),
    parentOrientation: () =>
      parent.value.type === 'menubar' ? parent.value.context.orientation.value : undefined,
    loopFocus,
    // Filtered menus keep DOM focus on the input, while keyboard and virtual opens initially
    // highlight an item as ordinary menus do. The input stays in the arrow-key loop unless the
    // filter highlights automatically.
    focusItemOnOpen: () => (virtualFocus ? store.state.keyboardOpen : undefined),
    allowEscape: () => virtualFocus && loopFocus.value && allowEscape.value,
    resetOnPointerLeave: options.resetOnPointerLeave,
    orientation,
    // A virtual-focus list can navigate on either axis, but its trigger always opens on the
    // vertical one.
    triggerOrientation: () => (virtualFocus ? 'vertical' : orientation.value),
    rtl: () => direction.value === 'rtl',
    disabledIndices: EMPTY_ARRAY,
    onNavigate(nextActiveIndex, event) {
      store.setActiveIndex(nextActiveIndex, getHighlightReason(event), event);
    },
    // A virtual-focus submenu's keyboard opening is orchestrated by its navigation wrapper based
    // on both menus' orientations; the generic arrow-key opening would also react to the parent's
    // forwarded cross-axis keys while closed.
    openOnArrowKeyDown: () => parent.value.type !== 'context-menu' && !(virtualFocus && isSubmenu),
    // A root context menu's focus manager is modal, so its guard swallows Tab when no item is
    // tabbable. Close it here instead, as a regular menu closes when Tab moves focus out.
    closeOnTab: () => parent.value.type === 'context-menu',
    externalTree: () => (!virtualFocus && nested.value ? floatingTreeRoot.value : undefined),
    nestedReturnFocusRef: () => parentMenuStore?.context.virtualFocusRef?.value,
    focusItemOnHover: () => props.highlightItemOnHover ?? true,
  });

  const typeahead = useTypeahead(store, {
    // Under virtual focus the input owns typing, so typeahead would race the filter query.
    enabled: () => !disabled.value && !virtualFocus,
    listRef: store.context.itemLabels,
    elementsRef: store.context.itemDomElements,
    activeIndex,
    resetMs: TYPEAHEAD_RESET_MS,
    onMatch(index, event) {
      if (open.value && index !== store.state.activeIndex) {
        store.setActiveIndex(index, REASONS.keyboard, event);
      }
    },
    onTyping(nextTyping) {
      store.context.typingRef.value = nextTyping;
    },
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
  watch(() => store.state.activeIndex, syncHighlightedItem, { flush: 'post' });

  function allowMouseEnter() {
    store.set('allowMouseEnter', true);
  }

  // The popup of a root context menu is modal. When Tab moves the focus out of a submenu, a focus
  // guard of that popup focuses its first tabbable element. Each submenu then closes, but the root
  // stays open. This handler closes each menu of the context menu, as Tab in the root does
  // (`VUE-107`).
  function closeContextMenuForTab(event: KeyboardEvent) {
    const menuParent = parent.value;
    if (
      event.key !== 'Tab' ||
      event.shiftKey ||
      menuParent.type !== 'menu' ||
      !isInContextMenu(menuParent)
    ) {
      return;
    }

    stopEvent(event);
    floatingTreeRoot.value.events.emit('close', { domEvent: event, reason: REASONS.focusOut });
  }

  const popupListeners = {
    onMousemove() {
      store.set('allowMouseEnter', true);
      if (toRaw(store.state).parent.type === 'menu') {
        store.set('hoverEnabled', false);
      }
    },
    onClick() {
      if (store.state.hoverEnabled) {
        store.set('hoverEnabled', false);
      }
    },
    onKeydown(event: KeyboardEvent) {
      closeContextMenuForTab(event);
      // The Menubar's CompositeRoot captures keyboard events via event delegation. This works well
      // when Menu.Root is nested inside Menubar, but with detached triggers we need to manually
      // forward the event to the CompositeRoot.
      const relay = menuSelectors.keyboardEventRelay(store.state);
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- `cancelBubble` is the only read that tells that a handler stopped the event.
      if (relay && !event.cancelBubble) {
        relay(event);
      }
    },
  };

  // The props of an inactive trigger depend on no state. One object keeps each inactive trigger from
  // a render when the menu opens.
  const inactiveTriggerProps = mergeProps(
    listNavigation.value.trigger,
    dismissTriggerBindings(dismiss),
    interactionTypeProps,
    {
      'aria-haspopup': 'menu',
      'aria-expanded': false,
    },
  );

  // Under virtual focus an element inside the popup holds real focus, so it takes the
  // navigation's reference props (`aria-activedescendant` and the key handling) and the trigger
  // keeps only the props that open the menu.
  function getOpenTriggerProps() {
    if (!virtualFocus) {
      return listNavigation.value.reference;
    }
    // Focusing the trigger while the menu is open must not seed the virtual highlight. This can
    // happen before a pointer press closes the menu in Safari.
    const { onFocusin, ...rest } = listNavigation.value.trigger;
    return rest;
  }

  bindParts({
    trigger: () =>
      mergeProps(
        typeahead.reference,
        getOpenTriggerProps(),
        dismissTriggerBindings(dismiss),
        {
          onMousemove: allowMouseEnter,
          'aria-haspopup': 'menu',
          'aria-expanded': open.value,
        },
        interactionTypeProps,
      ),
    inactiveTrigger: () => inactiveTriggerProps,
    popup: () =>
      mergeProps(
        FOCUSABLE_POPUP_PROPS,
        popupListeners,
        typeahead.floating,
        listNavigation.value.floating,
        dismissPopupBindings(dismiss),
      ),
  });
  watch(
    listNavigation,
    (navigation) => {
      store.update({
        itemProps: navigation.item,
        inputProps: virtualFocus ? navigation.reference : EMPTY_OBJECT,
      });
    },
    { immediate: true },
  );

  const activeTriggerElementId = useElementId(activeTriggerElement);
  // The `#render` slot of a trigger can give its element an id of its own, and an empty id names
  // no element. The registered id thus names the trigger only while no trigger element exists.
  const popupLabelId = computed(() =>
    activeTriggerElement.value ? activeTriggerElementId.value : triggerId.value,
  );

  const context: MenuRootContext<Payload> = {
    store,
    parent: parentFromContext,
    orientation,
    loopFocus,
    allowEscape,
    popupLabelId,
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

  return { payload, actions, context };
}

function isInContextMenu(menuParent: MenuParent): boolean {
  return menuParent.type === 'menu'
    ? isInContextMenu(menuParent.store.state.parent)
    : menuParent.type === 'context-menu';
}
