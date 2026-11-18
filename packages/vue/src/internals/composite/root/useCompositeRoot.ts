import {
  computed,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  useId,
  watch,
} from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_ARRAY } from '../../../common/empty';
import { isElementDisabled } from '../../../common/isElementDisabled';
import { ownerDocument } from '../../../common/owner';
import { activeElement, contains, getTarget } from '../../../common/shadowDom';
import { useControlled } from '../../../common/useControlled';
import { useDirection } from '../../direction-context/DirectionContext';
import type { HTMLProps } from '../../types';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  MODIFIER_KEYS,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isIndexOutOfListBounds,
  isListIndexDisabled,
  isNativeInput,
  scrollIntoViewIfNeeded,
} from '../composite';
import type { DisabledIndices } from '../listIndex';
import type { ModifierKey } from '../composite';
import { HYDRATING_COMPOSITE_ITEM } from '../constants';
import { useCompositeList } from '../list/useCompositeList';
import type { CompositeMetadata } from '../list/useCompositeList';
import { CompositeRootContext } from './CompositeRootContext';
import type { CompositeGridNavigator } from './gridNavigation';

/**
 * Gives a root part the highlighted index and the keyboard navigation of a composite.
 * Call it in `setup`. It makes the registry of the items and provides `CompositeRootContext`.
 * The part gives `rootRef` to `useRenderElement` in `ref`, and `props` as the first set of `props`.
 * The listeners of the consumer then run before the listeners of the composite.
 */
export function useCompositeRoot<Metadata>(
  params: UseCompositeRootParameters<Metadata>,
): UseCompositeRootReturnValue {
  // Base UI gives `direction` as a parameter. A handler here reads it when a key comes, so a change
  // of `DirectionProvider` applies.
  const direction = useDirection();
  const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

  let rootElement: HTMLElement | null = null;
  let hasSetDefaultIndex = false;
  let hasGivenInitialTabStop = false;
  let highlightedElement: HTMLElement | null = null;
  let tabStopObserver: MutationObserver | null = null;
  let canHaveUnmountedTabStop = true;
  let lastActiveItem: HTMLElement | null = null;

  const id = useId();
  const hasUnmountedTabStop = shallowRef(false);

  const [highlightedIndex, setHighlightedIndex] = useControlled({
    controlled: () => toValue(params.highlightedIndex),
    default: () => 0,
    name: 'CompositeRoot',
    state: 'highlightedIndex',
  });

  function getOrientation() {
    return toValue(params.orientation) ?? 'both';
  }

  // The setter writes the state only when the root is uncontrolled. Base UI writes no state when
  // the root has a callback. No Base UI part gives the callback without `highlightedIndex`, so
  // this difference changes no part.
  function onHighlightedIndexChange(index: number, shouldScrollIntoView = false) {
    highlightedElement = elementsRef.value[index] ?? null;
    params.onHighlightedIndexChange?.(index);
    setHighlightedIndex(index);
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.value[index];
      scrollIntoViewIfNeeded(rootElement, newActiveItem, direction.value, getOrientation());
    }
  }

  function onMapChange(map: Map<Element, CompositeMetadata<Metadata>>) {
    // An empty map means that no item is mounted, for example under `KeepAlive`. The index stays.
    if (map.size === 0) {
      return;
    }

    const disabledIndices = toValue(params.disabledIndices) ?? itemDisabled;

    if (hasSetDefaultIndex) {
      const elements = elementsRef.value;
      // Items that come or go around the highlighted item change its index. The tab stop must
      // follow the item. Without this step, navigation continues from the wrong place.
      const nextIndex = elements.indexOf(highlightedElement);

      if (nextIndex === -1) {
        // A replacement at the same index keeps the tab stop. If the replacement is missing,
        // hidden or disabled, the tab stop moves to the fallback index. The composite then stays
        // in the tab order.
        const replacement = elements[highlightedIndex.value];
        if (
          !replacement ||
          isListIndexDisabled(elements, highlightedIndex.value, disabledIndices)
        ) {
          onHighlightedIndexChange(getFallbackIndex(elements, isActive, disabledIndices));
        } else {
          highlightedElement = replacement;
        }
      } else if (nextIndex !== highlightedIndex.value) {
        onHighlightedIndexChange(nextIndex);
      }

      // A new map can bring an active item: an item that mounts late, or the items of a
      // `KeepAlive` that is active again.
      moveTabStopToActiveItem();
      return;
    }

    hasSetDefaultIndex = true;

    const elements = elementsRef.value;
    const { item: activeItem, index: activeIndex } = readActiveItem(elements);

    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(elements, highlightedIndex.value, disabledIndices)) {
      // The default item is disabled, so it must not hold the tab stop. The browser removes a
      // native disabled element from the tab order, and an `aria-disabled` element must not be the
      // entry point. The tab stop moves to the first enabled item. If each item is disabled, the
      // index stays.
      const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
      if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }

    lastActiveItem = readActiveItem(elementsRef.value).item;
    // The first map also starts the search. Base UI keeps the tab stop on an active item that
    // cannot get focus, such as a checked radio that is a disabled native button. The Tab key then
    // skips the composite.
    moveTabStopToActiveItem();

    scrollIntoViewIfNeeded(rootElement, activeItem, direction.value, getOrientation());
  }

  function itemDisabled(index: number) {
    const element = elementsRef.value[index];
    // A render slot can supply its own native or ARIA disabled state.
    return (
      !element ||
      toValue(list.map.value.get(element)?.itemState?.disabled) ||
      isElementDisabled(element)
    );
  }

  function canHoldTabStop(elements: readonly (HTMLElement | null)[], index: number) {
    return (
      !itemDisabled(index) && !isListIndexDisabled(elements, index, toValue(params.disabledIndices))
    );
  }

  function isActive(element: HTMLElement | null) {
    return element != null && toValue(list.map.value.get(element)?.itemState?.active) === true;
  }

  function readActiveItem(elements: readonly (HTMLElement | null)[]) {
    const index = elements.findIndex(isActive);
    return {
      item: elements[index] ?? null,
      index,
      canHoldTabStop: canHoldTabStop(elements, index),
    };
  }

  function highlightIndex(index: number) {
    if (index !== -1 && index !== highlightedIndex.value) {
      onHighlightedIndexChange(index);
    }
  }

  // A reset of a form and a controlled value change the active item while the composite does not
  // have the focus. The tab stop then moves to the active item, so the Tab key enters the
  // composite on that item, as it does for a native radio group. If the change leaves no active
  // item that can hold the tab stop, the tab stop moves to the first item that can hold it, as the
  // APG radio pattern says for a group with no checked radio. While the composite has the focus,
  // the highlight stays on the item that the user chose, and the keys continue from it.
  // Base UI moves the tab stop to the active item only in `Tabs.Tab`.
  function moveTabStopToActiveItem() {
    const elements = elementsRef.value;
    // `KeepAlive` empties the list. The map of the next activation starts the move again.
    if (elements.length === 0) {
      return;
    }

    const activeItem = readActiveItem(elements);
    // Only another active item is a change. An active item that becomes disabled keeps the tab
    // stop while it can get focus, as at the first map.
    const hasChanged = activeItem.item !== lastActiveItem;
    // An active item that leaves the list is a removal, and `onMapChange` has already moved the
    // tab stop for it, as in Base UI.
    const isRemoval = lastActiveItem !== null && !elements.includes(lastActiveItem);
    lastActiveItem = activeItem.item;

    const focused = activeElement(ownerDocument(rootElement));
    if (contains(rootElement, focused) || elements.some((item) => contains(item, focused))) {
      return;
    }

    if (activeItem.canHoldTabStop) {
      highlightIndex(activeItem.index);
      return;
    }

    if (hasChanged && !isRemoval) {
      highlightIndex(elements.findIndex((_, index) => canHoldTabStop(elements, index)));
      return;
    }

    // The tab stop stays where it is, unless the keys skip that item.
    moveTabStopOffSkippedItem(elements, activeItem.index);
  }

  // An item that the keys skip must not be the entry point. The active item is the exception while
  // it can get focus. The Tab key then enters a Radio Group on its checked radio also when that
  // radio is disabled, as in Base UI.
  function moveTabStopOffSkippedItem(
    elements: readonly (HTMLElement | null)[],
    activeIndex: number,
  ) {
    const index = highlightedIndex.value;
    const disabledIndices = toValue(params.disabledIndices) ?? itemDisabled;
    // With an empty `disabledIndices`, the test finds only an item that cannot get focus.
    const canKeepTabStop = !isListIndexDisabled(
      elements,
      index,
      index === activeIndex ? EMPTY_ARRAY : disabledIndices,
    );
    if (canKeepTabStop) {
      return;
    }

    const fallbackIndex = getFallbackIndex(elements, isActive, disabledIndices);
    if (elements[fallbackIndex] && !isListIndexDisabled(elements, fallbackIndex, disabledIndices)) {
      highlightIndex(fallbackIndex);
    }
  }

  // The APG radio and tabs patterns put the focus on the active item when the focus enters the
  // composite. A composite with no active item keeps the item that had the focus last, unless the
  // keys skip that item.
  function onFocusout(event: FocusEvent) {
    if (contains(rootElement, event.relatedTarget as Element | null)) {
      return;
    }

    const elements = elementsRef.value;
    const activeItem = readActiveItem(elements);
    if (activeItem.canHoldTabStop) {
      highlightIndex(activeItem.index);
      return;
    }

    moveTabStopOffSkippedItem(elements, activeItem.index);
  }

  const list = useCompositeList<Metadata>({
    elementsRef,
    onMapChange: (newMap) => {
      params.onMapChange?.(newMap);
      onMapChange(newMap);
    },
  });

  function run() {
    const disabledIndices = toValue(params.disabledIndices);
    // `disabledIndices` can arrive after the first map, for example when a parent derives it from
    // the metadata in the map. The tab stop at index 0 can then be on a disabled item, and the
    // composite has no tab stop. The check moves the tab stop to the first enabled item.
    // It runs only when `disabledIndices` has a value, the root is uncontrolled and the first map
    // is done. A composite with no `disabledIndices` relies on the disabled state of the DOM.
    if (
      disabledIndices == null ||
      toValue(params.highlightedIndex) != null ||
      !hasSetDefaultIndex
    ) {
      return;
    }
    const elements = elementsRef.value;
    if (isListIndexDisabled(elements, highlightedIndex.value, disabledIndices)) {
      const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
      if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }
  }

  onMounted(run);
  // The check reads `elementsRef`, so the list of elements is a source. Under `KeepAlive`, the
  // items register again in `onActivated`, and the list sorts in a later post-flush job. A check
  // that runs before that sort reads an empty list, so it must run again after the sort.
  watch(
    [
      () => toValue(params.disabledIndices),
      () => toValue(params.highlightedIndex),
      highlightedIndex,
      elementsRef,
    ],
    run,
    { flush: 'post' },
  );

  function wrappedOnLoop(event: KeyboardEvent, prevIndex: number, nextIndex: number) {
    if (!params.onLoop) {
      return nextIndex;
    }
    return params.onLoop(event, prevIndex, nextIndex, elementsRef);
  }

  function onKeydown(event: KeyboardEvent) {
    const enableHomeAndEndKeys = toValue(params.enableHomeAndEndKeys) ?? false;
    const isHomeOrEnd = event.key === HOME || event.key === END;
    if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys && isHomeOrEnd)) {
      return;
    }

    if (isModifierKeySet(event, toValue(params.modifierKeys) ?? EMPTY_ARRAY)) {
      return;
    }

    if (!rootElement) {
      return;
    }

    const orientation = getOrientation();
    const loopFocus = toValue(params.loopFocus) ?? true;
    const disabledIndices = toValue(params.disabledIndices) ?? itemDisabled;
    const prevIndex = highlightedIndex.value;
    const isRtl = direction.value === 'rtl';

    const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
    const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
    const forwardKey = orientation === 'vertical' ? ARROW_DOWN : horizontalForwardKey;
    const backwardKey = orientation === 'vertical' ? ARROW_UP : horizontalBackwardKey;

    const target = getTarget(event);
    if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const textContent = target.value;
      // A native input keeps its own arrow keys in three cases:
      // 1. Shift is held, or the input has a selection. An input type that has no selection has a
      //    `null` `selectionStart`.
      if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
        return;
      }
      // 2. The key moves forward and the caret is not at the end of the text.
      if (event.key !== backwardKey && selectionStart < textContent.length) {
        return;
      }
      // 3. The key moves backward and the caret is not at the start of the text.
      if (event.key !== forwardKey && selectionStart > 0) {
        return;
      }
    }

    let nextIndex = prevIndex;
    const minIndex = getMinListIndex(elementsRef, disabledIndices);
    const maxIndex = getMaxListIndex(elementsRef, disabledIndices);

    const grid = params.grid;
    if (grid != null) {
      nextIndex = grid({
        disabledIndices,
        elementsRef,
        event,
        highlightedIndex: prevIndex,
        loopFocus,
        maxIndex,
        minIndex,
        onLoop: wrappedOnLoop,
        orientation,
        rtl: isRtl,
      });
    }

    const isForwardKey =
      (orientation !== 'vertical' && event.key === horizontalForwardKey) ||
      (orientation !== 'horizontal' && event.key === ARROW_DOWN);
    const isBackwardKey =
      (orientation !== 'vertical' && event.key === horizontalBackwardKey) ||
      (orientation !== 'horizontal' && event.key === ARROW_UP);

    if (enableHomeAndEndKeys) {
      if (event.key === HOME) {
        nextIndex = minIndex;
      } else if (event.key === END) {
        nextIndex = maxIndex;
      }
    }

    if (nextIndex === prevIndex && (isForwardKey || isBackwardKey)) {
      if (loopFocus && nextIndex === maxIndex && isForwardKey) {
        nextIndex = minIndex;
        if (params.onLoop) {
          nextIndex = params.onLoop(event, prevIndex, nextIndex, elementsRef);
        }
      } else if (loopFocus && nextIndex === minIndex && isBackwardKey) {
        nextIndex = maxIndex;
        if (params.onLoop) {
          nextIndex = params.onLoop(event, prevIndex, nextIndex, elementsRef);
        }
      } else {
        nextIndex = findNonDisabledListIndex(elementsRef.value, {
          startingIndex: nextIndex,
          decrement: isBackwardKey,
          disabledIndices,
        });
      }
    }

    if (nextIndex !== prevIndex && !isIndexOutOfListBounds(elementsRef.value, nextIndex)) {
      if (toValue(params.stopEventPropagation) ?? true) {
        event.stopPropagation();
      }

      if (grid != null || isHomeOrEnd || isForwardKey || isBackwardKey) {
        event.preventDefault();
      }
      onHighlightedIndexChange(nextIndex, true);

      // The focus waits one microtask. A focus manager can return focus first, and the move must
      // come after it.
      queueMicrotask(() => {
        elementsRef.value[nextIndex]?.focus();
      });
    }
  }

  // A native input selects its text when it gets focus. The first arrow key then clears the
  // selection in the input, and the next arrow key can move focus.
  function onFocusin(event: FocusEvent) {
    const target = getTarget(event);
    if (!rootElement || target == null || !isNativeInput(target)) {
      return;
    }
    target.setSelectionRange(0, target.value.length);
  }

  // This function gives the tab stop of the server HTML and of the first client render. An item
  // keeps that tab stop until the item is mounted. The function gives `true` to at most one
  // caller, in the order of the `setup` calls.
  // A server writes the HTML of an item right after the `setup` of that item. It does not know the
  // items that come later, so it cannot find the first enabled item of the document.
  // The order of `setup` is the order of the document, with the exceptions that the comment in
  // `useCompositeListItem` lists. Two exceptions are usual.
  // - An item below a component with an async `setup`. A server runs the `setup` of that item
  //   after the items that follow it. The tab stop can then be on a later enabled item until the
  //   first sort after the mount.
  // - An item in an async component that a module makes one time, such as a lazy component of
  //   Nuxt. After its first render, a server has loaded the component and runs its `setup` in the
  //   order of the document. A browser has not loaded it when the page hydrates, so it runs that
  //   `setup` after the later items. The server and the browser then give the tab stop to
  //   different items. The item gives `data-allow-mismatch` while it hydrates, so Vue reports no
  //   mismatch. After the mount, Vue writes the `tabindex` again and the DOM follows the
  //   highlighted index.
  // An item that is mounted after its root keeps the `tabindex` of the server HTML until its own
  // mount. While the server HTML has the tab stop on such an item, the mounted items do not take the
  // tab stop. The list then has one tab stop.
  // The server HTML has no tab stop in three cases.
  // - `hasActiveItem` is `true` and no item is active.
  // - Each item is disabled.
  // - The root is controlled, the highlighted index is above 0, and no enabled item has that index
  //   or a higher index.
  function takeInitialTabStop(index: number, active: boolean, disabled: boolean) {
    if (hasGivenInitialTabStop) {
      return false;
    }

    const isTabStop = toValue(params.hasActiveItem)
      ? active
      : !disabled && index >= highlightedIndex.value;
    hasGivenInitialTabStop = isTabStop;

    return isTabStop;
  }

  // The server HTML can give the tab stop to an item that is mounted after its root. That item can
  // have no `setup` yet, so only the DOM tells the root. Each item that hydrates has an attribute
  // with the id of its root. Thus an item of a nested composite and an element of the consumer do
  // not count.
  // Limit: the search covers the element of the root only. The root does not find an item whose
  // element is outside it, for example in a `Teleport`. If the server HTML gives that item the tab
  // stop, the list can have two tab stops until the item is mounted.
  // The first check runs in a post-flush job. That job runs after the renders that the mounted
  // hooks queue, so each mounted item has already removed its attribute. A check in `onMounted`
  // would be too early.
  function updateUnmountedTabStop() {
    if (!rootElement || !canHaveUnmountedTabStop) {
      return;
    }

    const hasTabStop = Array.from(
      rootElement.querySelectorAll(`[${HYDRATING_COMPOSITE_ITEM}]`),
    ).some(
      (element) =>
        element.getAttribute(HYDRATING_COMPOSITE_ITEM) === id &&
        element.getAttribute('tabindex') === '0',
    );
    hasUnmountedTabStop.value = hasTabStop;

    if (hasTabStop) {
      if (!tabStopObserver && typeof MutationObserver === 'function') {
        tabStopObserver = new MutationObserver(updateUnmountedTabStop);
        tabStopObserver.observe(rootElement, {
          attributes: true,
          attributeFilter: [HYDRATING_COMPOSITE_ITEM],
          childList: true,
          subtree: true,
        });
      }
    } else {
      // Only a server can write the attribute with a tab stop, so no element can come later.
      tabStopObserver?.disconnect();
      tabStopObserver = null;
      canHaveUnmountedTabStop = false;
    }
  }

  watch(elementsRef, updateUnmountedTabStop, { flush: 'post' });
  onScopeDispose(() => tabStopObserver?.disconnect());

  watch(
    () =>
      Array.from(list.map.value.values(), ({ itemState }) => [
        toValue(itemState?.active),
        toValue(itemState?.disabled),
      ]),
    moveTabStopToActiveItem,
    { flush: 'post' },
  );

  watch(
    list.map,
    (map, _previous, onCleanup) => {
      if (!map.size || typeof MutationObserver !== 'function') {
        return;
      }
      // A consumer can change these attributes on the actual item in a render slot.
      const observer = new MutationObserver(moveTabStopToActiveItem);
      const fieldsets = new Set<HTMLFieldSetElement>();
      for (const element of map.keys()) {
        observer.observe(element, { attributeFilter: ['disabled', 'aria-disabled'] });
        for (
          let fieldset = element.parentElement?.closest('fieldset');
          fieldset && !fieldsets.has(fieldset);
          fieldset = fieldset.parentElement?.closest('fieldset')
        ) {
          fieldsets.add(fieldset);
        }
      }
      // A native fieldset exempts controls in its first legend.
      for (const fieldset of fieldsets) {
        observer.observe(fieldset, {
          attributeFilter: ['disabled', 'aria-disabled'],
          childList: true,
        });
      }
      onCleanup(() => observer.disconnect());
    },
    { flush: 'post' },
  );

  provide(CompositeRootContext, {
    highlightedIndex,
    onHighlightedIndexChange,
    highlightItemOnHover: computed(() => toValue(params.highlightItemOnHover) ?? false),
    relayKeyboardEvent: onKeydown,
    takeInitialTabStop,
    id,
    hasUnmountedTabStop: computed(() => hasUnmountedTabStop.value),
  });

  return {
    props: { onFocusin, onFocusout, onKeydown },
    elementsRef,
    itemMap: list.map,
    rootRef(element) {
      rootElement = element;
    },
    highlightedIndex,
  };
}

// Gives the index of the item that holds the tab stop: the active item if it can get focus, or the
// first item that can. If no item can, the index is 0. The index then stays in range, and the
// composite gets a tab stop when an item can get focus.
function getFallbackIndex(
  elements: readonly (HTMLElement | null)[],
  isActive: (element: HTMLElement) => boolean,
  disabledIndices: DisabledIndices,
) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (isActive(element)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: readonly ModifierKey[]) {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}

export interface UseCompositeRootParameters<Metadata> {
  /**
   * The direction of the arrow keys that move the highlight.
   * @default 'both'
   */
  orientation?: MaybeRefOrGetter<'horizontal' | 'vertical' | 'both' | undefined> | undefined;
  /**
   * The grid navigator that `gridNavigation` makes. With a grid, the arrow keys move the highlight
   * by cell. A root with no grid does not import `gridNavigation`, so a bundler can remove the
   * grid code. This is a plain function, and the root reads it when a key comes.
   */
  grid?: CompositeGridNavigator | undefined;
  /**
   * Whether the highlight goes from the last item to the first item, and from the first item to
   * the last item.
   * @default true
   */
  loopFocus?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Called when the highlight goes from one end of the list to the other end.
   * It gets the index before the move and the index after the move. It returns the index that the
   * highlight moves to.
   */
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: Readonly<Ref<readonly (HTMLElement | null)[]>>,
      ) => number)
    | undefined;
  /**
   * The highlighted index, when the root is controlled.
   */
  highlightedIndex?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Called with the new index when the highlighted index changes.
   */
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  /**
   * When `true`, the Home key moves focus to the first item,
   * and the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * When `true`, a key that moves the highlight calls `event.stopPropagation()`.
   * @default true
   */
  stopEventPropagation?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * The indexes of the items that the composite treats as disabled.
   * Use it for items that can get focus when they are disabled. The keys then reach an
   * `aria-disabled` item that is not in it, and such an item can keep the tab stop.
   */
  disabledIndices?: MaybeRefOrGetter<number[] | undefined> | undefined;
  /**
   * The [modifier keys](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys)
   * that can be pressed while the arrow keys still move the highlight.
   * By default, the highlight does not move when a modifier key is pressed.
   * @default []
   */
  modifierKeys?: MaybeRefOrGetter<ModifierKey[] | undefined> | undefined;
  /**
   * Whether an item gets focus when the pointer moves over it. The item reads this value from the
   * context.
   * @default false
   */
  highlightItemOnHover?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Called with the new map when an index, an element, an explicit index or a metadata value
   * changes.
   */
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata>>) => void) | undefined;
  /**
   * Tells the root that an item is active. The tab stop of the server HTML is then the first active
   * item. If no item is active, the server HTML has no tab stop. Set it only when the root knows
   * that an item is active. Base UI does not have this parameter. Its server HTML has
   * `tabindex="-1"` on each item.
   */
  hasActiveItem?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface UseCompositeRootReturnValue {
  itemMap: ComputedRef<ReadonlyMap<Element, CompositeMetadata<unknown>>>;
  /**
   * The listeners of the composite: `onFocusin`, `onFocusout` and `onKeydown`.
   * The part puts this object first in the `props` of `useRenderElement`.
   */
  props: Omit<HTMLProps, 'ref'>;
  /**
   * The elements of the items, ordered by their index. An item with no explicit index has the index
   * of its position in the document. An explicit index can leave an empty slot.
   * The list is empty on a server and before the mount of the root.
   * The composable gives the ref a new array on each sort.
   */
  elementsRef: Readonly<Ref<readonly (HTMLElement | null)[]>>;
  /**
   * Gives the element of the root to the composite, and `null` when the element goes away.
   * The part gives it to `useRenderElement` in `ref`.
   */
  rootRef: (element: HTMLElement | null) => void;
  /**
   * The highlighted index.
   */
  highlightedIndex: ComputedRef<number>;
}
