import { computed, onActivated, onDeactivated, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useCompositeListContext } from './CompositeListContext';
import type { CompositeListRegistration } from './CompositeListContext';

/**
 * Registers a list item and gives it its index (DOM position) in the list that
 * `useCompositeList` made. An item with no list has the explicit index, or `-1`.
 * Give `ref` to the element of the item, for example to `useRenderElement`.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const context = useCompositeListContext();

  // An item with no explicit index takes its index from the counter of the list. `setup` runs one
  // time for each item, in document order, on a server and in a browser. The server HTML and the
  // first client render thus have the same index.
  // The index is wrong until the mount in two cases.
  // One case is a list that also has an item with an explicit index. The counter does not know the
  // slot that the explicit index takes.
  // The other case is an item in an async component. Its `setup` runs after the `setup` of the
  // items that follow it.
  const guess = context && toValue(params.index) == null ? context.takeIndexGuess() : -1;

  let element: HTMLElement | null = null;
  let wasDeactivated = false;

  const registration: CompositeListRegistration<Metadata> = {
    metadata: params.metadata,
    index: params.index,
    label: params.label,
    textRef: params.textRef,
  };

  const index = computed<number>(() => {
    const explicitIndex = toValue(params.index);
    if (explicitIndex != null) {
      return explicitIndex;
    }

    // The read of `map` comes before the test of `element`. `element` is a plain variable, and an
    // item has no element in its first render. A `computed` that reads no ref never computes again.
    const map = context?.map.value;
    return (element ? map?.get(element)?.index : undefined) ?? guess;
  });

  function ref(node: HTMLElement | null) {
    // Vue calls a function ref again on each patch.
    if (!context || node === element) {
      return;
    }

    if (element) {
      context.unregister(element);
    }

    element = node;

    if (node) {
      context.register(node, registration);
    }
  }

  if (context) {
    // The item does not register again when a value changes. It only asks the list to sort again.
    // Items that share one element take the entry in the order of their ref calls. A register from
    // a watcher would let a later update of an inner item take the entry from the outer item.
    watch(
      [
        () => toValue(params.index),
        () => toValue(params.label),
        () => toValue(params.metadata),
        () => toValue(params.textRef),
      ],
      () => context.scheduleMapUpdate(),
    );

    // `KeepAlive` removes the element from the document and calls no ref callback.
    onDeactivated(() => {
      wasDeactivated = true;
      if (element) {
        context.unregister(element);
      }
    });

    // `onActivated` also runs at the first mount in a `KeepAlive`, when the item is still registered.
    onActivated(() => {
      if (!wasDeactivated) {
        return;
      }

      wasDeactivated = false;
      if (element) {
        context.register(element, registration);
      }
    });
  }

  return { ref, index };
}

export interface UseCompositeListItemParameters<Metadata> {
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

interface UseCompositeListItemReturnValue {
  /**
   * Gives the element of the item to the list. Call it with `null` when the element is removed.
   */
  ref: (node: HTMLElement | null) => void;
  /**
   * The explicit index, or the position of the item in the list. An item with no list and no
   * explicit index has `-1`.
   */
  index: ComputedRef<number>;
}
