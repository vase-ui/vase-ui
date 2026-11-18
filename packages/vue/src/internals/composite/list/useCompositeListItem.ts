import { computed, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { useKeepAliveState } from '../../useKeepAliveState';
import { useCompositeListContext } from './CompositeListContext';
import type {
  CompositeItemState,
  CompositeListContextValue,
  CompositeListRegistration,
} from './CompositeListContext';

/**
 * Registers a list item and gives it its index (DOM position) in the list that
 * `useCompositeList` made. An item with no list has the explicit index, or `-1`.
 * Give `ref` to the element of the item, for example to `useRenderElement`.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const context = params.list ?? useCompositeListContext();

  // The server has no DOM order. Use setup order until the list can sort the elements.
  const guess = context && toValue(params.index) == null ? context.takeIndexGuess() : -1;

  const element = shallowRef<HTMLElement | null>(null);

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

  function ref(node: HTMLElement | null) {
    element.value = node;
  }

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

  return { ref, element, index };
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

interface UseCompositeListItemReturnValue {
  element: Readonly<Ref<HTMLElement | null>>;
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
