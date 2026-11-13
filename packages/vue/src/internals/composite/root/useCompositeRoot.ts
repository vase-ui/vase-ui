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
import { getTarget } from '../../../common/shadowDom';
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
import type { ModifierKey } from '../composite';
import { ACTIVE_COMPOSITE_ITEM, HYDRATING_COMPOSITE_ITEM } from '../constants';
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
  const direction = useDirection();
  const elementsRef = shallowRef<Array<HTMLElement | null>>([]);

  let rootElement: HTMLElement | null = null;
  let hasSetDefaultIndex = false;
  let hasGivenInitialTabStop = false;
  let highlightedElement: HTMLElement | null = null;
  let tabStopObserver: MutationObserver | null = null;
  let canHaveUnmountedTabStop = true;

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

    const disabledIndices = toValue(params.disabledIndices);

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
          onHighlightedIndexChange(getFallbackIndex(elements, disabledIndices));
        } else {
          highlightedElement = replacement;
        }
      } else if (nextIndex !== highlightedIndex.value) {
        onHighlightedIndexChange(nextIndex);
      }
      return;
    }

    hasSetDefaultIndex = true;

    const sortedElements = Array.from(map.keys()) as Array<HTMLElement | null>;
    const activeItem =
      sortedElements.find((compositeElement) =>
        compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM),
      ) ?? null;
    // The default index is the index that the map holds for the active item. It is not the
    // position of the item among the keys, because a list can have explicit and automatic indexes
    // and gaps.
    const activeIndex = activeItem ? (map.get(activeItem)?.index ?? -1) : -1;

    if (activeIndex !== -1) {
      onHighlightedIndexChange(activeIndex);
    } else if (isListIndexDisabled(sortedElements, highlightedIndex.value, disabledIndices)) {
      // The default item is disabled, so it must not hold the tab stop. The browser removes a
      // native disabled element from the tab order, and an `aria-disabled` element must not be the
      // entry point. The tab stop moves to the first enabled item. If each item is disabled, the
      // index stays.
      const firstEnabledIndex = findNonDisabledListIndex(sortedElements, { disabledIndices });
      if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
        onHighlightedIndexChange(firstEnabledIndex);
      }
    }

    scrollIntoViewIfNeeded(rootElement, activeItem, direction.value, getOrientation());
  }

  useCompositeList<Metadata>({
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
    const disabledIndices = toValue(params.disabledIndices);
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
  // not count. An item whose element is outside the element of the root, in a `Teleport`, is not
  // found.
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

  onScopeDispose(() => {
    tabStopObserver?.disconnect();
    tabStopObserver = null;
  });

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
    props: { onFocusin, onKeydown },
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
  elements: ReadonlyArray<HTMLElement | null>,
  disabledIndices?: ReadonlyArray<number> | undefined,
) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: ReadonlyArray<ModifierKey>) {
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
   * by cell. A root that gets no `grid` does not load the code of the grid. This is a plain
   * function, and the root reads it when a key comes.
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
        elementsRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>>,
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
   * Use it for items that can get focus when they are disabled.
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
  /**
   * The listeners of the composite: `onFocusin` and `onKeydown`.
   * The part puts this object first in the `props` of `useRenderElement`.
   */
  props: Omit<HTMLProps, 'ref'>;
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
