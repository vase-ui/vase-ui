import {
  computed,
  onMounted,
  onScopeDispose,
  onWatcherCleanup,
  provide,
  shallowRef,
  toValue,
  triggerRef,
  watch,
} from 'vue';
import type { ShallowRef } from 'vue';
import { areArraysEqual } from '../../../common/areArraysEqual';
import { CompositeListContext } from './CompositeListContext';
import type {
  CompositeItemState,
  CompositeListContextValue,
  CompositeListRegistration,
} from './CompositeListContext';

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
      // Check the order only after a move. A move is a node that the DOM removed and added again
      // in the same batch. An addition or a removal alone does not change the order of the other
      // items. An item that mounts or unmounts sorts the list through `register` or `unregister`.
      if (!hasMovedNode(entries)) {
        return;
      }

      let previousConnectedNode: Element | null = null;

      // If a connected node is now before the previous connected node, an item or one of its
      // wrappers moved, and the list must sort again.
      for (const node of sortedNodes) {
        if (!node.isConnected) {
          continue;
        }

        if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
          triggerRef(registry);
          return;
        }

        previousConnectedNode = node;
      }
    });

    onWatcherCleanup(() => observer.disconnect());

    // A reorder that changes an index must invert at least one adjacent pair of the last sorted
    // order. The common ancestor of each pair sees the move of an item and the move of a wrapper
    // at the boundary. A pair with no common ancestor has no observer, and its items still register.
    const roots = new Set<Element>();
    for (let i = 1; i < sortedNodes.length; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The loop runs from 1 to the last index, so `i - 1` and `i` are indexes of `sortedNodes`.
      const root = getCommonAncestor(sortedNodes[i - 1]!, sortedNodes[i]!);
      if (root) {
        roots.add(root);
      }
    }

    roots.forEach((root) => observer.observe(root, { childList: true }));
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

function hasMovedNode(entries: MutationRecord[]) {
  for (const entry of entries) {
    for (const node of entry.removedNodes) {
      if (node.isConnected) {
        return true;
      }
    }
  }

  return false;
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
