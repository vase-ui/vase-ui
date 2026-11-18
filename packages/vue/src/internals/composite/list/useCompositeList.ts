import {
  computed,
  inject,
  onMounted,
  onScopeDispose,
  onWatcherCleanup,
  provide,
  shallowRef,
  toValue,
  triggerRef,
  watch,
} from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { areArraysEqual } from '../../../common/areArraysEqual';
import { useKeepAliveState } from '../../useKeepAliveState';

export type CompositeMetadata<CustomMetadata> = {
  index: number;
  itemState?: CompositeItemState;
} & CustomMetadata;

interface CompositeListItem<Metadata> {
  index: number;
  element: HTMLElement;
  itemState: CompositeItemState | undefined;
  explicitIndex: number | undefined;
  metadata: Metadata | undefined;
  label: string | null | undefined;
  textElement: HTMLElement | null | undefined;
}

/**
 * Makes the registry of the items of a composite and returns it. The part that owns the list calls
 * it in `setup`. Each item part calls `useCompositeListItem`.
 */
export function useCompositeList<Metadata>(
  params: UseCompositeListParameters<Metadata>,
): CompositeListContextValue<Metadata> {
  const { elementsRef, labelsRef, onMapChange } = params;

  const registrations = new Map<Element, CompositeListRegistration<Metadata>>();
  // A ref callback can write to the map without a subscription to other items.
  const registry = shallowRef(registrations);
  const publishedMap = shallowRef<ReadonlyMap<Element, CompositeMetadata<Metadata>>>(new Map());
  let nextIndex = 0;

  function register(node: Element, registration: CompositeListRegistration<Metadata>) {
    registrations.set(node, registration);
    triggerRef(registry);
  }

  function unregister(node: Element, registration: CompositeListRegistration<Metadata>) {
    if (registrations.get(node) !== registration) {
      return;
    }
    registrations.delete(node);
    triggerRef(registry);
  }

  function takeIndexGuess() {
    return nextIndex++;
  }

  function syncRefs(items: readonly CompositeListItem<Metadata>[]) {
    const nextMap = new Map<Element, CompositeMetadata<Metadata>>();
    // An explicit index can leave an empty slot.
    const elements: (HTMLElement | null)[] = [];
    const labels: (string | null)[] = [];

    items.forEach((item) => {
      nextMap.set(item.element, {
        ...(item.metadata ?? ({} as Metadata)),
        index: item.index,
        ...(item.itemState && { itemState: item.itemState }),
      });

      elements[item.index] = item.element;

      if (labelsRef) {
        labels[item.index] =
          item.label !== undefined
            ? item.label
            : (item.textElement?.textContent ?? item.element.textContent);
      }
    });

    elementsRef.value = elements;
    if (labelsRef) {
      labelsRef.value = labels;
    }

    nextIndex = elements.length;

    return nextMap;
  }

  function observe(sortedNodes: HTMLElement[]) {
    // A single item cannot change its order. Some environments have no `MutationObserver`.
    if (typeof MutationObserver !== 'function' || sortedNodes.length < 2) {
      return;
    }

    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        for (const node of entry.removedNodes) {
          if (node.isConnected && sortedNodes.some((item) => node.contains(item))) {
            observeRoots(true);
            return;
          }
        }
      }
    });

    function observeRoots(checkOrder: boolean) {
      const roots = new Set<Element>();
      let previous: HTMLElement | undefined;
      for (const node of sortedNodes) {
        if (!node.isConnected) {
          continue;
        }
        if (previous) {
          if (checkOrder && sortByDocumentPosition(previous, node) > 0) {
            triggerRef(registry);
            return;
          }
          const root = getCommonAncestor(previous, node);
          if (root) {
            roots.add(root);
          }
        }
        previous = node;
      }

      // A Teleport can move an item out of its observed subtree without changing its index.
      observer.disconnect();
      roots.forEach((root) => observer.observe(root, { childList: true, subtree: true }));
    }

    observeRoots(false);
    onWatcherCleanup(() => observer.disconnect());
  }

  onMounted(() => {
    watch(
      () => getCompositeListSnapshot(registry.value),
      ({ items, automaticNodes }, previous) => {
        const nextMap = syncRefs(items);
        observe(automaticNodes);

        // A label change updates the labels but preserves the published map.
        if (
          previous &&
          areArraysEqual(
            previous.items,
            items,
            (a, b) =>
              a.element === b.element &&
              a.index === b.index &&
              a.explicitIndex === b.explicitIndex &&
              a.itemState === b.itemState &&
              a.metadata === b.metadata,
          )
        ) {
          return;
        }

        publishedMap.value = nextMap;
        onMapChange?.(nextMap);
      },
      { immediate: true, flush: 'post' },
    );
  });

  onScopeDispose(() => {
    elementsRef.value = [];
    if (labelsRef) {
      labelsRef.value = [];
    }
  });

  const context: CompositeListContextValue<Metadata> = {
    register,
    unregister,
    takeIndexGuess,
    map: computed(() => publishedMap.value),
  };

  if (params.provide !== false) {
    provide(CompositeListContext, context);
  }

  return context;
}

function getCompositeListSnapshot<Metadata>(
  registrations: Map<Element, CompositeListRegistration<Metadata>>,
) {
  const reservedIndices = new Set<number>();
  const items: CompositeListItem<Metadata>[] = [];
  const automaticItems: CompositeListItem<Metadata>[] = [];

  registrations.forEach((registration, node) => {
    const explicitIndex = toValue(registration.index);
    const item: CompositeListItem<Metadata> = {
      index: explicitIndex ?? -1,
      element: node as HTMLElement,
      explicitIndex,
      metadata: toValue(registration.metadata),
      itemState: registration.itemState,
      label: toValue(registration.label),
      textElement: toValue(registration.textRef),
    };

    // A DOM removal outside Vue preserves the registration. Its next change can reveal a reattached item.
    if (!node.isConnected) {
      return;
    }

    if (explicitIndex == null) {
      automaticItems.push(item);
    } else if (explicitIndex >= 0) {
      reservedIndices.add(explicitIndex);
      items.push(item);
    }
  });

  let nextAutomaticIndex = 0;
  automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));

  automaticItems.forEach((item) => {
    while (reservedIndices.has(nextAutomaticIndex)) {
      nextAutomaticIndex += 1;
    }

    item.index = nextAutomaticIndex;
    items.push(item);
    nextAutomaticIndex += 1;
  });

  if (reservedIndices.size > 0) {
    items.sort((a, b) => a.index - b.index);
  }

  return { items, automaticNodes: automaticItems.map((item) => item.element) };
}

function getCommonAncestor(firstNode: Element, lastNode: Element) {
  let ancestor = firstNode.parentElement;

  // The `parentElement` walk cannot cross a shadow boundary, so the native `contains` is enough.
  while (ancestor && !ancestor.contains(lastNode)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor;
}

function sortByDocumentPosition(a: Element, b: Element) {
  // Adjacent siblings are the common case for a list that is already in order.
  // `compareDocumentPosition` scans the siblings from the first child of the parent. Without this
  // test, the sort of a long flat list would be quadratic.
  if (a.nextElementSibling === b) {
    return -1;
  }
  if (b.nextElementSibling === a) {
    return 1;
  }
  // `DOCUMENT_POSITION_CONTAINED_BY` always comes with `FOLLOWING`, and `CONTAINS` with `PRECEDING`.
  // A test of `FOLLOWING` alone thus orders siblings and nested items.
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export interface UseCompositeListParameters<Metadata> {
  /**
   * The elements of the items, ordered by their index.
   * Explicit indexes can leave empty slots in the array.
   * The list gives the ref a new array on each sort.
   */
  elementsRef: ShallowRef<(HTMLElement | null)[]>;
  /**
   * The labels of the items, ordered by their index.
   * The list gives the ref a new array on each sort.
   */
  labelsRef?: ShallowRef<(string | null)[]> | undefined;
  /**
   * Called with the new map when an index, an element, an explicit index or a metadata value
   * changes.
   */
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata>>) => void) | undefined;
  /**
   * Whether the parts below the caller get the list from `inject`. With `false`, the caller gives
   * the list to its items, and each item gives it to `useCompositeListItem` as `list`. The other
   * parts in the slot of the caller then get the list around the caller.
   * @default true
   */
  provide?: boolean | undefined;
}

export interface CompositeItemState {
  active?: MaybeRefOrGetter<boolean | undefined> | undefined;
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  selected?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface CompositeListRegistration<Metadata> {
  itemState?: CompositeItemState | undefined;
  metadata: MaybeRefOrGetter<Metadata | undefined>;
  index: MaybeRefOrGetter<number | undefined>;
  label: MaybeRefOrGetter<string | null | undefined>;
  textRef: MaybeRefOrGetter<HTMLElement | null | undefined>;
}

export interface CompositeListContextValue<Metadata> {
  register: (node: Element, registration: CompositeListRegistration<Metadata>) => void;
  unregister: (node: Element, registration: CompositeListRegistration<Metadata>) => void;
  takeIndexGuess: () => number;
  map: ComputedRef<ReadonlyMap<Element, CompositeMetadata<Metadata>>>;
}

export const CompositeListContext: InjectionKey<CompositeListContextValue<any>> = Symbol();

export function useCompositeListContext(): CompositeListContextValue<any> | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // An item with no list is valid, so this function does not throw.
  return inject(CompositeListContext, undefined);
}

/**
 * Registers a list item and gives it its index (DOM position) in the list that
 * `useCompositeList` made. An item with no list has the explicit index, or `-1`.
 */
export function useCompositeListItem<Metadata>(
  element: Readonly<Ref<HTMLElement | null>>,
  params: UseCompositeListItemParameters<Metadata> = {},
): ComputedRef<number> {
  const context = params.list ?? useCompositeListContext();

  // The server has no DOM order. Use setup order until the list can sort the elements.
  const guess = context && toValue(params.index) == null ? context.takeIndexGuess() : -1;

  const registration: CompositeListRegistration<Metadata> = {
    metadata: params.metadata,
    itemState: params.itemState,
    index: params.index,
    label: params.label,
    textRef: params.textRef,
  };

  const index = computed<number>(() => {
    const explicitIndex = toValue(params.index);
    if (explicitIndex != null) {
      return explicitIndex;
    }

    return (element.value ? context?.map.value.get(element.value)?.index : undefined) ?? guess;
  });

  if (context) {
    const { isHeld } = useKeepAliveState();
    // A hold moves the item without calling its ref. Register synchronously to preserve the
    // order of the ref calls when two items share an element.
    watch(
      [element, isHeld],
      ([node, held], _previous, onCleanup) => {
        if (node && !held) {
          context.register(node, registration);
          onCleanup(() => context.unregister(node, registration));
        }
      },
      { flush: 'sync' },
    );
  }

  return index;
}

export interface UseCompositeListItemParameters<Metadata> {
  itemState?: CompositeItemState | undefined;
  /**
   * The list that the item registers with. The default is the nearest list that a
   * `useCompositeList` above the item provides. The item reads it one time, in `setup`.
   */
  list?: CompositeListContextValue<Metadata>;
  /**
   * The explicit index of the item. An item with no explicit index gets its index from its position
   * in the document.
   */
  index?: MaybeRefOrGetter<number | undefined>;
  /**
   * The label of the item. `null` means that the item has no label.
   * The default is the text of `textRef`, or the text of the element of the item.
   */
  label?: MaybeRefOrGetter<string | null | undefined>;
  /**
   * Metadata that the list publishes with the item. Give an object through a `computed` or a ref.
   * A getter that makes a new object on each call makes the list publish a new map on each sort.
   */
  metadata?: MaybeRefOrGetter<Metadata | undefined>;
  /**
   * The element that holds the text of the label.
   */
  textRef?: MaybeRefOrGetter<HTMLElement | null | undefined>;
}
