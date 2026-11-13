import { computed, onMounted, onScopeDispose, provide, shallowRef, toValue, watch } from 'vue';
import type { ShallowRef } from 'vue';
import { CompositeListContext } from './CompositeListContext';
import type { CompositeListContextValue, CompositeListRegistration } from './CompositeListContext';

export type CompositeMetadata<CustomMetadata> = {
  index: number;
} & CustomMetadata;

interface CompositeListItem<Metadata> {
  index: number;
  element: HTMLElement;
  explicitIndex: number | undefined;
  metadata: Metadata | undefined;
  label: string | null | undefined;
  textElement: HTMLElement | null | undefined;
}

/**
 * Makes the registry of the items of a composite. The part that owns the list calls it in `setup`.
 * Each item part calls `useCompositeListItem`.
 */
export function useCompositeList<Metadata>(params: UseCompositeListParameters<Metadata>): void {
  const { elementsRef, labelsRef, onMapChange } = params;

  const registrations = new Map<Element, CompositeListRegistration<Metadata>>();
  const publishedMap = shallowRef<ReadonlyMap<Element, CompositeMetadata<Metadata>>>(new Map());
  // Vue calls a ref callback during a render, and a read of reactive state in that callback makes
  // the render depend on that state. The code that a ref callback reaches reads no reactive state.
  // So the trigger is only written, from a plain counter.
  const trigger = shallowRef(0);
  let tick = 0;
  let nextIndex = 0;
  // The first sort runs in `onMounted`, so the registrations before it write no trigger.
  let isDirty = true;
  let previousItems: readonly CompositeListItem<Metadata>[] | null = null;
  let mutationObserver: MutationObserver | null = null;

  function scheduleMapUpdate() {
    if (isDirty) {
      return;
    }

    isDirty = true;
    trigger.value = ++tick;
  }

  function register(node: Element, registration: CompositeListRegistration<Metadata>) {
    registrations.set(node, registration);
    scheduleMapUpdate();
  }

  function unregister(node: Element) {
    registrations.delete(node);
    scheduleMapUpdate();
  }

  function takeIndexGuess() {
    return nextIndex++;
  }

  function syncRefs(items: readonly CompositeListItem<Metadata>[]) {
    const nextMap = new Map<Element, CompositeMetadata<Metadata>>();
    // An explicit index can leave an empty slot.
    const elements: Array<HTMLElement | null> = [];
    const labels: Array<string | null> = [];

    items.forEach((item) => {
      nextMap.set(item.element, {
        ...(item.metadata ?? ({} as Metadata)),
        index: item.index,
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
    mutationObserver?.disconnect();
    mutationObserver = null;

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
          observer.disconnect();
          scheduleMapUpdate();
          return;
        }

        previousConnectedNode = node;
      }
    });

    mutationObserver = observer;

    // A reorder that changes an index must invert at least one adjacent pair of the last sorted
    // order. The common ancestor of each pair sees the move of an item and the move of a wrapper
    // at the boundary. A pair with no common ancestor has no observer, and its items still register.
    const roots = new Set<Element>();
    for (let i = 1; i < sortedNodes.length; i += 1) {
      const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
      if (root) {
        roots.add(root);
      }
    }

    roots.forEach((root) => observer.observe(root, { childList: true }));
  }

  function flush() {
    isDirty = false;

    const [items, automaticNodes] = getCompositeListSnapshot(registrations);
    const nextMap = syncRefs(items);

    // Both snapshots hold the same registration objects, so the test compares the values that the
    // snapshots resolved from them.
    const previous = previousItems;
    const changed =
      !previous ||
      previous.length !== items.length ||
      items.some((item, index) => {
        const previousItem = previous[index];
        return (
          item.index !== previousItem.index ||
          item.element !== previousItem.element ||
          item.explicitIndex !== previousItem.explicitIndex ||
          item.metadata !== previousItem.metadata
        );
      });

    observe(automaticNodes);
    previousItems = items;

    if (!changed) {
      return;
    }

    // A watcher of the map with `flush: 'sync'` runs here, before `onMapChange`, as the subscribers
    // of Base UI do.
    publishedMap.value = nextMap;
    onMapChange?.(nextMap);
  }

  function run() {
    if (isDirty) {
      flush();
    }
  }

  onMounted(run);
  watch(trigger, run, { flush: 'post' });

  onScopeDispose(() => {
    mutationObserver?.disconnect();
    mutationObserver = null;
    elementsRef.value = [];
    if (labelsRef) {
      labelsRef.value = [];
    }
  });

  const context: CompositeListContextValue<Metadata> = {
    register,
    unregister,
    scheduleMapUpdate,
    takeIndexGuess,
    map: computed(() => publishedMap.value),
  };

  provide(CompositeListContext, context);
}

function getCompositeListSnapshot<Metadata>(
  registrations: Map<Element, CompositeListRegistration<Metadata>>,
) {
  const reservedIndices = new Set<number>();
  const items: CompositeListItem<Metadata>[] = [];
  const automaticItems: CompositeListItem<Metadata>[] = [];

  registrations.forEach((registration, node) => {
    // An element that left the document outside Vue stays registered, because no ref callback runs.
    // `compareDocumentPosition` has no meaning for it, and it would scramble the order of the
    // other items.
    if (!node.isConnected) {
      return;
    }

    const explicitIndex = toValue(registration.index);
    const item: CompositeListItem<Metadata> = {
      index: explicitIndex ?? -1,
      element: node as HTMLElement,
      explicitIndex,
      metadata: toValue(registration.metadata),
      label: toValue(registration.label),
      textElement: toValue(registration.textRef),
    };

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

  return [items, automaticItems.map((item) => item.element)] as const;
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
    for (let i = 0; i < entry.removedNodes.length; i += 1) {
      if (entry.removedNodes[i].isConnected) {
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
  elementsRef: ShallowRef<Array<HTMLElement | null>>;
  /**
   * The labels of the items, ordered by their index.
   * The list gives the ref a new array on each sort.
   */
  labelsRef?: ShallowRef<Array<string | null>> | undefined;
  /**
   * Called with the new map when an index, an element, an explicit index or a metadata value
   * changes.
   */
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<Metadata>>) => void) | undefined;
}
