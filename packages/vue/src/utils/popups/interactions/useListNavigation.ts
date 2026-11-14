import {
  computed,
  inject,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  provide,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { activeElement, contains, getTarget } from '../../../common/shadowDom';
import { useAnimationFrame } from '../../../common/useAnimationFrame';
import { warn } from '../../../common/warn';
import {
  getMaxListIndex,
  getMinListIndex,
  getNextListIndex,
  isIndexOutOfListBounds,
} from '../../../internals/composite/listIndex';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../constants';
import {
  getFloatingFocusElement,
  isEventTargetWithin,
  isTypeableCombobox,
  isTypeableElement,
} from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import { enqueueFocus } from '../focus/enqueueFocus';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { InteractionProps, ListNavigationElementProps, PopupInteractionStore } from '../types';
import type { gridNavigation } from './gridNavigation';

type Orientation = 'vertical' | 'horizontal' | 'both';

// WebKit fires zero-delta `mousemove`/`pointermove` events when the list scrolls
// beneath a stationary pointer, moving the highlight during keyboard navigation.
// https://github.com/mui/base-ui/issues/4002
function isStationaryWebKitPointer(event: MouseEvent | PointerEvent) {
  return platform.engine.webkit && event.movementX === 0 && event.movementY === 0;
}

function doSwitch(orientation: Orientation | undefined, vertical: boolean, horizontal: boolean) {
  switch (orientation) {
    case 'vertical':
      return vertical;
    case 'horizontal':
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

export function isMainOrientationKey(key: string, orientation: Orientation | undefined) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN;
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal);
}

export function isMainOrientationToEndKey(
  key: string,
  orientation: Orientation | undefined,
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return (
    doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
  );
}

export function isCrossOrientationOpenKey(
  key: string,
  orientation: Orientation | undefined,
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

export function isCrossOrientationCloseKey(
  key: string,
  orientation: Orientation | undefined,
  rtl: boolean,
  grid: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === 'both' || (orientation === 'horizontal' && grid)) {
    return key === 'Escape';
  }
  return doSwitch(orientation, vertical, horizontal);
}

export type ListGridNavigator = typeof gridNavigation;

export interface UseListNavigationProps {
  /**
   * A ref that holds an array of list items. The composable reads it only in a handler and after a
   * DOM update, so it does not follow a change of the list.
   */
  listRef: Readonly<Ref<Array<HTMLElement | null>>>;
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   */
  activeIndex: MaybeRefOrGetter<number | null>;
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?: ((activeIndex: number | null, event: Event | undefined) => void) | undefined;
  /**
   * Whether the composable is enabled, including its effects and its event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The currently selected item index, which may or may not be active.
   * @default null
   */
  selectedIndex?: MaybeRefOrGetter<number | null | undefined>;
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: MaybeRefOrGetter<boolean | 'auto' | undefined>;
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether pressing an arrow key on the navigation's main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This option allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select popups, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   *
   * The composable reads the option one time, so a function is the form that follows a change.
   * @default undefined
   */
  disabledIndices?: ReadonlyArray<number> | ((index: number) => boolean) | undefined;
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loopFocus` must be `true`.
   * @default false
   */
  allowEscape?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loopFocus?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Allows to specify the orientation of the parent list, which is used to
   * determine the direction of the navigation.
   * This is useful when list navigation is used within a Composite,
   * as the composable can't determine the orientation of the parent list automatically.
   */
  parentOrientation?: MaybeRefOrGetter<Orientation | undefined>;
  /**
   * Whether the direction of the floating element's navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * @default false
   */
  virtual?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: MaybeRefOrGetter<Orientation | undefined>;
  /**
   * The orientation used to open the list from its trigger.
   * @default orientation
   */
  triggerOrientation?: MaybeRefOrGetter<Orientation | undefined>;
  /**
   * The id of the root component.
   */
  id?: MaybeRefOrGetter<string | undefined>;
  /**
   * Whether to clear the active index when the pointer leaves an item.
   * @default true
   */
  resetOnPointerLeave?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
  /**
   * Focus target used when a nested list returns to a virtually focused parent.
   */
  nestedReturnFocusRef?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Computes two-dimensional list navigation for grid-capable consumers. The value is a ref or a
   * getter of the navigator, because `toValue` calls a function: `grid: () => gridNavigation`.
   */
  grid?:
    | Readonly<Ref<ListGridNavigator | null | undefined>>
    | (() => ListGridNavigator | null | undefined)
    | undefined;
  /**
   * Whether Tab closes the open list the same way Shift+Tab does.
   * @default false
   */
  closeOnTab?: MaybeRefOrGetter<boolean | undefined>;
}

interface ListNavigationParent {
  handleFloatingKeydown(event: KeyboardEvent): void;
}

// React gives a `keydown` of a portal child to the handlers of the popup around the component.
// A DOM event of a list that `Teleport` moved does not reach the popup element of the list above.
// Each `useListNavigation` call provides the handler that needs such an event, and the call
// below it in the component tree calls it.
const ListNavigationParentContext: InjectionKey<ListNavigationParent> = Symbol();

interface SyncState {
  deactivated: boolean;
  enabled: boolean;
  open: boolean;
  positionerElement: HTMLElement | null;
  anchorElement: Element | null;
  activeIndex: number | null;
  selectedIndex: number | null;
  focusItemOnOpen: boolean | 'auto';
  virtual: boolean;
  nested: boolean;
  triggerOrientation: Orientation;
  rtl: boolean;
  tree: FloatingTreeStore | null;
  parentId: string | null;
}

/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 *
 * Call it in the `setup` of the root of the popup.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function useListNavigation(
  store: PopupInteractionStore,
  props: UseListNavigationProps,
): ComputedRef<ListNavigationElementProps> {
  const { listRef, onNavigate: onNavigateProp, disabledIndices } = props;

  const isEnabled = () => toValue(props.enabled) ?? true;
  const getActiveIndex = () => toValue(props.activeIndex);
  const getSelectedIndex = () => toValue(props.selectedIndex) ?? null;
  const getFocusItemOnOpen = () => toValue(props.focusItemOnOpen) ?? 'auto';
  const shouldFocusItemOnHover = () => toValue(props.focusItemOnHover) ?? true;
  const shouldOpenOnArrowKeyDown = () => toValue(props.openOnArrowKeyDown) ?? true;
  const shouldAllowEscape = () => toValue(props.allowEscape) ?? false;
  const shouldLoopFocus = () => toValue(props.loopFocus) ?? false;
  const isNested = () => toValue(props.nested) ?? false;
  const isRtl = () => toValue(props.rtl) ?? false;
  const isVirtual = () => toValue(props.virtual) ?? false;
  const getOrientation = () => toValue(props.orientation) ?? 'vertical';
  const getTriggerOrientation = () => toValue(props.triggerOrientation) ?? getOrientation();
  const shouldResetOnPointerLeave = () => toValue(props.resetOnPointerLeave) ?? true;
  const shouldCloseOnTab = () => toValue(props.closeOnTab) ?? false;
  const getGrid = () => toValue(props.grid) ?? null;

  if (process.env.NODE_ENV !== 'production') {
    const warnWhenOptionsDisagree = () => {
      const allowEscape = shouldAllowEscape();
      if (allowEscape && !shouldLoopFocus()) {
        warn(
          '`useListNavigation` has `allowEscape` and no `loopFocus`.',
          '`allowEscape` has no effect while `loopFocus` is `false`.',
          'Set `loopFocus` to `true`, or remove `allowEscape`.',
        );
      }
      if (allowEscape && !isVirtual()) {
        warn(
          '`useListNavigation` has `allowEscape` and no `virtual`.',
          'With real focus, an item of the list always has the focus.',
          'Set `virtual` to `true`, or remove `allowEscape`.',
        );
      }
      if (getOrientation() === 'vertical' && getGrid() != null) {
        warn(
          '`useListNavigation` has a `grid` and the orientation "vertical".',
          'The horizontal arrow keys then do not move the highlight in the grid.',
          'Set `orientation` to "horizontal" or "both".',
        );
      }
    };
    onMounted(warnWhenOptionsDisagree);
    watch(
      () => [
        shouldAllowEscape(),
        shouldLoopFocus(),
        isVirtual(),
        getOrientation(),
        getGrid() != null,
      ],
      warnWhenOptionsDisagree,
    );
  }

  const storeContext = store.context;

  const readFloatingFocusElement = () => getFloatingFocusElement(store.select('positionerElement'));

  const parentId = useFloatingParentNodeId();
  const tree = useFloatingTree(props.externalTree);

  let focusItemOnOpenValue = getFocusItemOnOpen();
  let index = getSelectedIndex() ?? -1;
  let key: null | string = null;
  let isPointerModality = true;

  function onNavigate(event?: Event) {
    onNavigateProp?.(index === -1 ? null : index, event);
  }

  let previousMounted = !!store.select('positionerElement');
  let previousOpen = store.select('open');
  let forceSyncFocus = false;
  let forceScrollIntoView = false;
  let cancelQueuedFocus: (() => void) | null = null;

  const focusFrame = useAnimationFrame();
  const waitForListPopulatedFrame = useAnimationFrame();

  function focusItem() {
    // Synchronous navigation must also supersede any deferred focus from an earlier update.
    focusFrame.cancel();

    function runFocus(item: HTMLElement) {
      if (!isVirtual()) {
        cancelQueuedFocus = enqueueFocus(item, {
          sync: forceSyncFocus,
          preventScroll: true,
        });
      }
    }

    const initialItem = listRef.value[index];
    const forceScroll = forceScrollIntoView;

    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocus
      ? (callback: () => void) => callback()
      : (callback: () => void) => focusFrame.request(callback);

    scheduler(() => {
      const waitedItem = listRef.value[index] || initialItem;

      if (!waitedItem) {
        return;
      }

      if (!initialItem) {
        runFocus(waitedItem);
      }

      if (forceScroll || !isPointerModality) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });
  }

  function writeOrientation(orientation: Orientation) {
    storeContext.orientation = orientation;
  }
  // A server does not call `onBeforeMount`. The hook runs before the `setup` of the lists below.
  onBeforeMount(() => writeOrientation(getOrientation()));
  watch(getOrientation, writeOrientation);

  // The dependencies of each effect of Base UI, from the last run of that effect.
  const lastDependencies = new Map<string, ReadonlyArray<unknown>>();
  function haveChanged(effect: string, dependencies: ReadonlyArray<unknown>) {
    const last = lastDependencies.get(effect);
    lastDependencies.set(effect, dependencies);
    return !last || dependencies.some((dependency, i) => !Object.is(dependency, last[i]));
  }

  const deactivated = shallowRef(false);

  function readState(): SyncState {
    return {
      deactivated: deactivated.value,
      enabled: isEnabled(),
      open: store.select('open'),
      positionerElement: store.select('positionerElement'),
      anchorElement: store.select('anchorElement'),
      activeIndex: getActiveIndex(),
      selectedIndex: getSelectedIndex(),
      focusItemOnOpen: getFocusItemOnOpen(),
      virtual: isVirtual(),
      nested: isNested(),
      triggerOrientation: getTriggerOrientation(),
      rtl: isRtl(),
      tree: tree.value,
      parentId: parentId.value,
    };
  }

  // Each block is one effect of Base UI. It runs when one of its dependencies changed since its
  // last run. `state` holds the values of one DOM update, as a render of React does: a block that
  // calls `onNavigate` does not change what the blocks after it read.
  function sync(state: SyncState) {
    const {
      enabled,
      open,
      positionerElement,
      anchorElement,
      activeIndex,
      selectedIndex,
      focusItemOnOpen,
      virtual,
      nested,
      triggerOrientation,
      rtl,
    } = state;

    if (state.deactivated) {
      focusFrame.cancel();
      waitForListPopulatedFrame.cancel();
      cancelQueuedFocus?.();
      cancelQueuedFocus = null;
      // `KeepAlive` takes the list out of the document, and the focus leaves it. The block
      // that focuses the active item runs again at the activation.
      lastDependencies.delete('active');
      return;
    }

    // Reset on its own: an explicit `focusItemOnOpen` can change one update before `open` does,
    // which must not discard the key the trigger just recorded.
    if (haveChanged('key', [open]) && !open) {
      key = null;
    }

    // Explicit values can change with the opening interaction. Keep an inferred 'auto' value
    // from the trigger event, but apply a boolean before the initial highlight is synchronized.
    if (haveChanged('focusItemOnOpen', [open, focusItemOnOpen])) {
      if (!open || focusItemOnOpen !== 'auto') {
        focusItemOnOpenValue = focusItemOnOpen;
      }
    }

    // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
    // element. Also, reset `activeIndex` upon closing the floating element.
    if (haveChanged('selected', [enabled, open, positionerElement, selectedIndex]) && enabled) {
      if (open && positionerElement) {
        index = selectedIndex ?? -1;
        if (focusItemOnOpenValue && selectedIndex != null) {
          // Regardless of the pointer modality, we want to ensure the selected
          // item comes into view when the floating element is opened.
          forceScrollIntoView = true;
          onNavigate();
        }
      } else if (previousMounted) {
        // Reset the active index when the list is no longer open and mounted (closing or
        // unmounting).
        index = -1;
        onNavigate();
      }
    }

    // Sync `activeIndex` to be the focused item while the floating element is
    // open.
    if (
      haveChanged('active', [
        enabled,
        open,
        positionerElement,
        activeIndex,
        nested,
        triggerOrientation,
        rtl,
      ]) &&
      enabled
    ) {
      if (!open) {
        forceSyncFocus = false;
      } else if (positionerElement) {
        if (activeIndex == null) {
          forceSyncFocus = false;

          if (selectedIndex == null) {
            // Reset while the floating element was open (e.g. the list changed).
            if (previousMounted) {
              index = -1;
              focusItem();
            }

            // Initial sync.
            if (
              (!previousOpen || !previousMounted) &&
              focusItemOnOpenValue &&
              (key != null || (focusItemOnOpenValue === true && key == null))
            ) {
              let runs = 0;
              const waitForListPopulated = () => {
                if (listRef.value[0] == null) {
                  // Avoid letting the browser paint if possible on the first try,
                  // otherwise use rAF. Don't try more than twice, since something
                  // is wrong otherwise.
                  if (runs < 2) {
                    const scheduler = runs
                      ? (callback: () => void) => waitForListPopulatedFrame.request(callback)
                      : queueMicrotask;
                    scheduler(waitForListPopulated);
                  }
                  runs += 1;
                } else {
                  // Initially focus the first non-disabled item. `disabledIndices` is deliberately
                  // omitted here so attribute-disabled items (`disabled`/`aria-disabled`) are skipped
                  // on open even when the consumer passes an empty `disabledIndices` array. Passing it
                  // would regress that behavior (see mui/base-ui#2604).
                  // The key came from the trigger, so it is read on the trigger's orientation.
                  index =
                    key == null || isMainOrientationToEndKey(key, triggerOrientation, rtl) || nested
                      ? getMinListIndex(listRef)
                      : getMaxListIndex(listRef);
                  key = null;
                  onNavigate();
                }
              };

              waitForListPopulated();
            }
          }
        } else if (!isIndexOutOfListBounds(listRef.value, activeIndex)) {
          index = activeIndex;
          focusItem();
          forceScrollIntoView = false;
        }
      }
    }

    // Ensure the parent floating element has focus when a nested child closes
    // to allow arrow key navigation to work after the pointer leaves the child.
    if (
      haveChanged('parentFocus', [
        enabled,
        positionerElement,
        anchorElement,
        state.tree,
        state.parentId,
        virtual,
      ]) &&
      enabled &&
      !positionerElement &&
      state.tree &&
      !virtual &&
      previousMounted
    ) {
      const nodes = state.tree.nodesRef.value;
      const parent = nodes.find((node) => node.id === state.parentId)?.context?.elements.floating;
      // `positionerElement` is null here (see the guard above), so resolve the owner document
      // from an in-DOM element for realm-safety (shadow DOM/iframes): the reference element, falling
      // back to the parent floating element when the reference is virtual (`anchorElement` is null).
      const activeEl = activeElement(ownerDocument(anchorElement ?? parent ?? null));
      const treeContainsActiveEl = nodes.some(
        (node) => node.context && contains(node.context.elements.floating, activeEl),
      );

      if (parent && !treeContainsActiveEl && isPointerModality) {
        parent.focus({ preventScroll: true });
      }
    }

    previousOpen = open;
    previousMounted = !!positionerElement;
  }

  onMounted(() => sync(readState()));
  watch(readState, sync, { flush: 'post' });
  onDeactivated(() => {
    deactivated.value = true;
  });
  onActivated(() => {
    deactivated.value = false;
  });

  function syncCurrentTarget(event: Event) {
    if (!store.select('open')) {
      return;
    }

    const itemIndex = listRef.value.indexOf(event.currentTarget as HTMLElement);
    if (itemIndex !== -1 && (index !== itemIndex || getActiveIndex() !== itemIndex)) {
      index = itemIndex;
      onNavigate(event);
    }
  }

  function getParentOrientation() {
    return (
      toValue(props.parentOrientation) ??
      tree.value?.nodesRef.value.find((node) => node.id === parentId.value)?.context?.rootStore
        .context.orientation
    );
  }

  function commonOnKeyDown(
    event: KeyboardEvent,
    currentTarget = event.currentTarget as Element | null,
  ) {
    isPointerModality = false;
    forceSyncFocus = true;

    // When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
    // don't appear to suffer from this. `event.isComposing` is avoided due to
    // Safari not supporting it properly (although it's not needed in the first
    // place for Safari, just avoiding any possible issues).
    if (event.keyCode === 229) {
      return;
    }

    const open = store.select('open');
    const orientation = getOrientation();
    const rtl = isRtl();
    const loopFocus = shouldLoopFocus();
    const navigateGrid = getGrid();
    const activeIndex = getActiveIndex();

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!open && currentTarget === readFloatingFocusElement()) {
      return;
    }

    if (
      isNested() &&
      isCrossOrientationCloseKey(event.key, orientation, rtl, navigateGrid != null)
    ) {
      // If the nested list's close key is also the parent navigation key,
      // let the parent navigate. Otherwise, stop propagating the event.
      if (!isMainOrientationKey(event.key, getParentOrientation())) {
        stopEvent(event);
      }

      const anchorElement = store.select('anchorElement');
      store.setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));

      const returnElement = toValue(props.nestedReturnFocusRef) ?? anchorElement;
      if (isHTMLElement(returnElement)) {
        returnElement.focus();
      }

      return;
    }

    // The consumer owns `activeIndex` and may decline a navigation this composable proposed, such
    // as a virtual list keeping its highlight when the reference is refocused. Declining produces
    // no update, so reconcile here: otherwise the cursor drifts from the rendered highlight and
    // this key moves from the wrong position.
    if (
      activeIndex != null &&
      activeIndex !== index &&
      !isIndexOutOfListBounds(listRef.value, activeIndex)
    ) {
      index = activeIndex;
    }

    const currentIndex = index;
    const minIndex = getMinListIndex(listRef, disabledIndices);
    const maxIndex = getMaxListIndex(listRef, disabledIndices);

    if (!isTypeableCombobox(store.select('anchorElement'))) {
      if (event.key === 'Home') {
        stopEvent(event);
        index = minIndex;
        onNavigate(event);
      }

      if (event.key === 'End') {
        stopEvent(event);
        index = maxIndex;
        onNavigate(event);
      }
    }

    // Grid navigation is injected by grid-capable consumers so non-grid
    // consumers (menu, select) tree-shake the grid helpers out.
    if (navigateGrid != null) {
      const gridIndex = navigateGrid(
        event,
        index,
        listRef,
        orientation,
        loopFocus,
        rtl,
        disabledIndices,
        minIndex,
        maxIndex,
      );

      // The grid navigator returns the unchanged index for keys it does not handle, and
      // reporting that as a navigation would re-emit the current highlight on every keydown.
      if (gridIndex != null && gridIndex !== index) {
        index = gridIndex;
        onNavigate(event);
      }

      if (orientation === 'both') {
        return;
      }
    }

    if (isMainOrientationKey(event.key, orientation)) {
      stopEvent(event);

      // Reset the index if no item is focused. Focus can also rest on a container inside the
      // popup, such as a list that holds the `menu` role. Keys bubbling from a portaled nested
      // popup are not in this popup's DOM, so they navigate from the current index.
      const focusedElement = activeElement(ownerDocument(currentTarget));
      if (
        open &&
        !isVirtual() &&
        contains(currentTarget, focusedElement) &&
        !listRef.value.some((item) => item != null && contains(item, focusedElement))
      ) {
        index = isMainOrientationToEndKey(event.key, orientation, rtl) ? minIndex : maxIndex;
        onNavigate(event);
        // The boundary item may already be highlighted, so `activeIndex` won't change and the
        // effect that moves focus to the highlighted item won't run.
        if (activeIndex === index) {
          focusItem();
        }
        return;
      }

      const next = getNextListIndex(listRef.value, currentIndex, {
        decrement: !isMainOrientationToEndKey(event.key, orientation, rtl),
        loopFocus,
        allowEscape: shouldAllowEscape(),
        disabledIndices,
        minIndex,
        maxIndex,
      });
      if (next.wrapped) {
        // Give time for virtualizers to update the listRef.
        forceSyncFocus = false;
      }
      index = next.index;

      onNavigate(event);
    }
  }

  const parent = inject(ListNavigationParentContext, undefined);

  function handleFloatingKeydown(event: KeyboardEvent, currentTarget: Element | null) {
    const open = store.select('open');
    const virtual = isVirtual();
    const floatingFocusElement = readFloatingFocusElement();

    // Close on Shift+Tab, and on Tab when `closeOnTab` is set.
    if (event.key === 'Tab' && (event.shiftKey || shouldCloseOnTab()) && open && !virtual) {
      // If the event originated from within a nested element (e.g., a Dialog opened from
      // within the menu), don't close the menu. The nested element has its own focus
      // management and should handle the Tab key.
      const target = getTarget(event) as Element | null;
      if (target && !contains(floatingFocusElement, target)) {
        return;
      }

      stopEvent(event);
      const anchorElement = store.select('anchorElement');
      const details = createChangeEventDetails(REASONS.focusOut, event);
      store.setOpen(false, details);

      const returnElement = toValue(props.nestedReturnFocusRef) ?? anchorElement;
      if (!details.isCanceled && isHTMLElement(returnElement)) {
        returnElement.focus();
      }

      return;
    }

    commonOnKeyDown(event, currentTarget);
  }

  provide(ListNavigationParentContext, {
    handleFloatingKeydown(event) {
      if (!isEnabled()) {
        parent?.handleFloatingKeydown(event);
        return;
      }
      const floatingFocusElement = readFloatingFocusElement();
      // The DOM gives the event to this popup itself when its element holds the target.
      if (isEventTargetWithin(event, floatingFocusElement)) {
        return;
      }
      handleFloatingKeydown(event, floatingFocusElement);
      if (!event.cancelBubble) {
        parent?.handleFloatingKeydown(event);
      }
    },
  });

  const item: InteractionProps = {
    onFocusin(event) {
      if (!isEnabled()) {
        return;
      }
      forceSyncFocus = true;
      syncCurrentTarget(event);
    },
    onMousemove(event) {
      if (!isEnabled() || isStationaryWebKitPointer(event)) {
        return;
      }
      forceSyncFocus = true;
      forceScrollIntoView = false;
      if (shouldFocusItemOnHover()) {
        syncCurrentTarget(event);
      }
    },
    onPointerleave(event) {
      if (
        !isEnabled() ||
        !store.select('open') ||
        !isPointerModality ||
        event.pointerType === 'touch'
      ) {
        return;
      }

      forceSyncFocus = true;

      if (!shouldResetOnPointerLeave()) {
        return;
      }

      const relatedTarget = isElement(event.relatedTarget) ? event.relatedTarget : null;
      if (
        !shouldFocusItemOnHover() ||
        listRef.value.some((listItem) => contains(listItem, relatedTarget))
      ) {
        return;
      }

      cancelQueuedFocus?.();
      cancelQueuedFocus = null;

      index = -1;
      onNavigate(event);

      if (!isVirtual()) {
        const floatingFocusElement = readFloatingFocusElement();
        const activeEl = activeElement(ownerDocument(floatingFocusElement));
        if (floatingFocusElement && contains(floatingFocusElement, activeEl)) {
          floatingFocusElement.focus({ preventScroll: true });
        }
      }
    },
  };

  const ariaActiveDescendant = computed(() => {
    const activeIndex = getActiveIndex();
    return isEnabled() && isVirtual() && store.select('open') && activeIndex != null
      ? `${toValue(props.id)}-${activeIndex}`
      : undefined;
  });

  const floatingHandlers: InteractionProps = {
    onKeydown(event) {
      if (!isEnabled()) {
        return;
      }
      handleFloatingKeydown(event, event.currentTarget as Element | null);
      if (!event.cancelBubble) {
        parent?.handleFloatingKeydown(event);
      }
    },
    onPointermove(event) {
      if (!isEnabled() || isStationaryWebKitPointer(event)) {
        return;
      }
      isPointerModality = true;
    },
  };

  function openOnNavigationKeyDown(event: KeyboardEvent) {
    store.setOpen(
      true,
      createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget as HTMLElement),
    );
  }

  function checkVirtualMouse(event: MouseEvent) {
    if (!isEnabled()) {
      return;
    }
    if (getFocusItemOnOpen() === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenValue = !isVirtual();
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    if (!isEnabled()) {
      return;
    }
    // `pointerdown` fires first, reset the state then perform the checks.
    focusItemOnOpenValue = getFocusItemOnOpen();
    if (getFocusItemOnOpen() === 'auto' && isVirtualPointerEvent(event)) {
      focusItemOnOpenValue = true;
    }
  }

  const trigger: InteractionProps = {
    onKeydown(event) {
      if (!isEnabled()) {
        return;
      }
      const currentOpen = store.select('open');
      isPointerModality = false;

      const nested = isNested();
      const virtual = isVirtual();
      const rtl = isRtl();
      const openOnArrowKeyDown = shouldOpenOnArrowKeyDown();

      const isArrowKey = event.key.startsWith('Arrow');
      const isParentCrossOpenKey = isCrossOrientationOpenKey(
        event.key,
        getParentOrientation(),
        rtl,
      );
      const isMainKey = isMainOrientationKey(
        event.key,
        currentOpen ? getOrientation() : getTriggerOrientation(),
      );
      const isNavigationKey =
        (nested ? isParentCrossOpenKey : isMainKey) ||
        event.key === 'Enter' ||
        event.key.trim() === '';

      if (virtual && currentOpen && (!nested || isTypeableElement(event.currentTarget))) {
        commonOnKeyDown(event);
        return;
      }

      // If a floating element should not open on arrow key down, avoid
      // setting `activeIndex` while it's closed.
      if (!currentOpen && !openOnArrowKeyDown && isArrowKey) {
        return;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
        key = nested && isParentMainKey ? null : event.key;
      }

      if (nested) {
        if (isParentCrossOpenKey) {
          stopEvent(event);

          if (currentOpen) {
            index = getMinListIndex(listRef, disabledIndices);
            onNavigate(event);
            if (virtual) {
              readFloatingFocusElement()?.focus();
            }
          } else {
            openOnNavigationKeyDown(event);
          }
        }

        return;
      }

      if (isMainKey) {
        const selectedIndex = getSelectedIndex();
        if (selectedIndex != null) {
          index = selectedIndex;
        }

        stopEvent(event);

        if (!currentOpen && openOnArrowKeyDown) {
          openOnNavigationKeyDown(event);
        } else {
          commonOnKeyDown(event);
        }

        if (currentOpen) {
          onNavigate(event);
        }
      }
    },
    onFocusin(event) {
      if (!isEnabled() || event.target !== event.currentTarget) {
        return;
      }

      if (store.select('open') && !isVirtual()) {
        index = -1;
        onNavigate(event);
      }
    },
    onPointerdown: checkVirtualPointer,
    onPointerenter: checkVirtualPointer,
    onMousedown: checkVirtualMouse,
    onClick: checkVirtualMouse,
  };

  return computed(() => {
    const activeDescendant = ariaActiveDescendant.value;
    if (activeDescendant === undefined) {
      return { reference: trigger, floating: floatingHandlers, item, trigger };
    }
    const activeDescendantProp = { 'aria-activedescendant': activeDescendant };
    return {
      reference: { ...activeDescendantProp, ...trigger },
      floating: isTypeableCombobox(store.select('anchorElement'))
        ? floatingHandlers
        : { ...activeDescendantProp, ...floatingHandlers },
      item,
      trigger,
    };
  });
}
