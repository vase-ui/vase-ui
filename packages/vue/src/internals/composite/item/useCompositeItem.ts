import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../../../common/hydration';
import { isElementDisabled } from '../../../common/isElementDisabled';
import type { HTMLProps } from '../../types';
import { HYDRATING_COMPOSITE_ITEM } from '../constants';
import { useCompositeListItem } from '../list/useCompositeListItem';
import type { UseCompositeListItemParameters } from '../list/useCompositeListItem';
import { useCompositeRootContext } from '../root/CompositeRootContext';

/**
 * Gives an item part its `tabindex` and its listeners in a composite. Call it in `setup`.
 * The part gives `compositeRef` to `useRenderElement` first in `ref`, and `compositeProps` as the
 * first set of `props`.
 */
export function useCompositeItem<Metadata>(
  params: UseCompositeItemParameters<Metadata> = {},
): UseCompositeItemReturnValue {
  const {
    hasUnmountedTabStop,
    highlightItemOnHover,
    highlightedIndex,
    id,
    detachedItemHandlers,
    onHighlightedIndexChange,
    takeInitialTabStop,
  } = useCompositeRootContext();
  const { ref, index } = useCompositeListItem({
    metadata: params.metadata,
    index: params.index,
    itemState: params,
  });
  const isHydrating = useIsHydrating();

  const initialTabStop = takeInitialTabStop(
    index.value,
    toValue(params.active) ?? false,
    toValue(params.disabled) ?? false,
  );

  // Until the item is mounted, it keeps the tab stop that `takeInitialTabStop` gave. This is also
  // true for an item that renders after its root is mounted, such as an item below a `<Suspense>`.
  // After the mount, the tab stop is the item at the highlighted index, as in Base UI. The
  // exception: while an item that is not mounted holds the tab stop, a mounted item does not take it.
  const isTabStop = computed(() =>
    isHydrating.value
      ? initialTabStop
      : !hasUnmountedTabStop.value && highlightedIndex.value === index.value,
  );

  // Only a listener reads the element, so it is a plain variable.
  let element: HTMLElement | null = null;

  function compositeRef(node: HTMLElement | null) {
    element = node;
    ref(node);
  }

  function onFocusin(event: FocusEvent) {
    onHighlightedIndexChange(index.value);
    detachedItemHandlers.onFocusin(event);
  }

  function onMousemove() {
    if (!highlightItemOnHover.value || !element) {
      return;
    }

    if (highlightedIndex.value !== index.value && !isElementDisabled(element)) {
      element.focus();
    }
  }

  const compositeProps = computed<Omit<HTMLProps, 'ref'>>(() => {
    const tabindex = isTabStop.value ? 0 : -1;
    return {
      // A browser can run `setup` in another order than a server, so its first `tabindex` can
      // differ from the server HTML. `data-allow-mismatch` stops the Vue warning for that.
      // Vue keeps the server `tabindex` from a `v-bind` object while it hydrates. The change
      // from a string to a number makes Vue write it after the mount.
      tabindex: isHydrating.value ? String(tabindex) : tabindex,
      'data-allow-mismatch': isHydrating.value ? 'attribute' : undefined,
      // The root finds the items that hydrate by this attribute.
      [HYDRATING_COMPOSITE_ITEM]: isHydrating.value ? id : undefined,
      onFocusin,
      onFocusout: detachedItemHandlers.onFocusout,
      onKeydown: detachedItemHandlers.onKeydown,
      onMousemove,
    };
  });

  return { compositeProps, compositeRef, index };
}

export interface UseCompositeItemParameters<Metadata> extends Pick<
  UseCompositeListItemParameters<Metadata>,
  'metadata' | 'index'
> {
  /** Whether the item is active, such as a checked radio. */
  active?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /** Whether the item is disabled. */
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /** Whether the picker option is selected. */
  selected?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface UseCompositeItemReturnValue {
  /**
   * The `tabindex` and the focus, mouse and keyboard listeners of the item.
   * While the item hydrates, the object also has `data-allow-mismatch` and
   * `data-vase-ui-hydrating-composite-item`, which holds the id of the root.
   * The part puts this object first in the `props` of `useRenderElement`.
   */
  compositeProps: ComputedRef<Omit<HTMLProps, 'ref'>>;
  /**
   * Gives the element of the item to the composite, and `null` when the element goes away.
   * The part gives it first to `useRenderElement` in `ref`. When two items share one element, the
   * outer item then registers last and owns the entry.
   */
  compositeRef: (element: HTMLElement | null) => void;
  /**
   * The index of the item in the list.
   */
  index: ComputedRef<number>;
}
