import { computed, provide, shallowRef, toValue, useId, watch, watchPostEffect } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { EMPTY_ARRAY } from '../../../common/empty';
import { useIsHydrated } from '../../../common/hydration';
import { isElementDisabled } from '../../../common/isElementDisabled';
import { contains, getTarget } from '../../../common/shadowDom';
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
import { observeRootNode } from '../../observeRootNode';
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
  const direction = useDirection();
  const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

  const rootElement = shallowRef<HTMLElement | null>(null);
  const mounted = useIsHydrated();

  let hasSetDefaultIndex = false;
  let hasGivenInitialTabStop = false;
  let highlightedElement: HTMLElement | null = null;
  let lastActiveItem: HTMLElement | null = null;

  const id = useId();
  const hasUnmountedTabStop = shallowRef(false);

  const highlightedIndex = useControlled({
    controlled: () => toValue(params.highlightedIndex),
    default: () => 0,
    name: 'CompositeRoot',
    state: 'highlightedIndex',
  });

  function getOrientation() {
    return toValue(params.orientation) ?? 'both';
  }

  function onHighlightedIndexChange(index: number, shouldScrollIntoView = false) {
    highlightedElement = elementsRef.value[index] ?? null;
    params.onHighlightedIndexChange?.(index);
    highlightedIndex.value = index;
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.value[index];
      scrollIntoViewIfNeeded(rootElement.value, newActiveItem, direction.value, getOrientation());
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
    } else {
      ensureEnabledIndex(disabledIndices);
    }

    lastActiveItem = readActiveItem(elementsRef.value).item;
    moveTabStopToActiveItem();

    scrollIntoViewIfNeeded(rootElement.value, activeItem, direction.value, getOrientation());
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

  function hasFocus() {
    return (
      rootElement.value?.matches(':focus-within') === true ||
      elementsRef.value.some((item) => item?.matches(':focus-within'))
    );
  }

  // Outside the composite, Tab should return to the active item. Inside it, keep the user's highlight.
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
    // tab stop for it.
    const isRemoval = lastActiveItem !== null && !elements.includes(lastActiveItem);
    lastActiveItem = activeItem.item;

    if (hasFocus()) {
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
  // it can get focus. Tab can then enter a radio group on its checked radio.
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
    const next = event.relatedTarget as Element | null;
    if (
      contains(rootElement.value, next) ||
      elementsRef.value.some((item) => contains(item, next))
    ) {
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

  function ensureEnabledIndex(disabledIndices: DisabledIndices) {
    const elements = elementsRef.value;
    if (isListIndexDisabled(elements, highlightedIndex.value, disabledIndices)) {
      const first = findNonDisabledListIndex(elements, { disabledIndices });
      if (!isIndexOutOfListBounds(elements, first)) {
        onHighlightedIndexChange(first);
      }
    }
  }

  // A parent can derive disabled indexes from the map after the items register.
  watchPostEffect(() => {
    const disabledIndices = toValue(params.disabledIndices);
    if (disabledIndices != null && toValue(params.highlightedIndex) == null) {
      ensureEnabledIndex(disabledIndices);
    }
  });

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

    if (!rootElement.value) {
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
    if (!rootElement.value || target == null || !isNativeInput(target)) {
      return;
    }
    target.setSelectionRange(0, target.value.length);
  }

  // The server emits each item before it knows the DOM order of later async children.
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

  // Wait for the mounted items to clear their server markers in their first patch.
  const stopTabStopWatch = watch(
    [() => (mounted.value ? rootElement.value : null), elementsRef],
    ([root], _previous, onCleanup) => {
      if (!root) {
        hasUnmountedTabStop.value = false;
        return;
      }

      const updateTabStop = () => {
        const pending = Array.from(
          root.querySelectorAll(`[${HYDRATING_COMPOSITE_ITEM}][tabindex="0"]`),
        ).some((item) => item.getAttribute(HYDRATING_COMPOSITE_ITEM) === id);
        hasUnmountedTabStop.value = pending;
        if (!pending) {
          // After the last server tab stop clears, the registry owns the tab stop.
          stopTabStopWatch();
        }
        return pending;
      };

      if (updateTabStop() && typeof MutationObserver === 'function') {
        const observer = new MutationObserver(updateTabStop);
        observer.observe(root, {
          attributeFilter: [HYDRATING_COMPOSITE_ITEM],
          childList: true,
          subtree: true,
        });
        onCleanup(() => observer.disconnect());
      }
    },
    { flush: 'post' },
  );

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
      for (const element of map.keys()) {
        observer.observe(element, { attributeFilter: ['disabled', 'aria-disabled'] });
        if (element.matches(':enabled, :disabled')) {
          // A move into another fieldset or its first legend can change the native state
          // without changing any attribute on the control.
          let nativeDisabled = element.matches(':disabled');
          onCleanup(
            observeRootNode(element, () => {
              const disabled = element.matches(':disabled');
              if (disabled !== nativeDisabled) {
                nativeDisabled = disabled;
                moveTabStopToActiveItem();
              }
            }, ['disabled']),
          );
        }
      }
      onCleanup(() => observer.disconnect());
    },
    { flush: 'post' },
  );

  // A teleported item belongs to the composite, but its native events can miss the root.
  function fromDetachedItem<E extends Event>(handle: (event: E) => void) {
    return (event: E) => {
      if (rootElement.value && !event.composedPath().includes(rootElement.value)) {
        handle(event);
      }
    };
  }

  provide(CompositeRootContext, {
    hasFocus,
    highlightedIndex,
    onHighlightedIndexChange,
    highlightItemOnHover: computed(() => toValue(params.highlightItemOnHover) ?? false),
    relayKeyboardEvent: onKeydown,
    detachedItemHandlers: {
      onFocusin: fromDetachedItem(onFocusin),
      onFocusout: fromDetachedItem(onFocusout),
      onKeydown: fromDetachedItem(onKeydown),
    },
    takeInitialTabStop,
    id,
    hasUnmountedTabStop,
  });

  return {
    props: { onFocusin, onFocusout, onKeydown },
    elementsRef,
    itemMap: list.map,
    rootRef(element) {
      rootElement.value = element;
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
   * Reserve the server tab stop for the first active item. If none is active, all items have `tabindex="-1"`.
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
