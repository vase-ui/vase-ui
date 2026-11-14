import { computed, inject, onMounted, provide, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { getFilter } from '../../internals/filter';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useItemRegistry } from '../../internals/useItemRegistry';
import { FilterDropdownStore } from '../store';
import {
  FilterDropdownItemContext,
  FilterDropdownRootContext,
  FilterDropdownValueContext,
} from './FilterDropdownRootContext';
import type {
  FilterDropdownFilter,
  FilterDropdownItemRegistration,
  FilterDropdownRootChangeEventDetails,
} from './FilterDropdownRootContext';

/**
 * Holds the filter query, matches it against the registered items, and publishes the result. The
 * host owns list navigation; this root moves the highlight through `setActiveIndex`.
 *
 * It provides the item context, the root context and the value context. Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownRoot(
  params: UseFilterDropdownRootParameters,
): UseFilterDropdownRootReturnValue {
  const { listRef, getActiveIndex, setActiveIndex, onValueChange } = params;

  const parentItemContext = inject(FilterDropdownItemContext, null);

  const renderedListId = shallowRef<string | undefined>(undefined);
  const initialOpenedByKeyboard = Boolean(toValue(params.openedByKeyboard));
  const inputFocusVisible = shallowRef(initialOpenedByKeyboard);
  const keyboardModality = shallowRef(initialOpenedByKeyboard);

  // Both reset when the host reports a new value, before a reader of the state runs.
  watch(
    () => Boolean(toValue(params.openedByKeyboard)),
    (openedByKeyboard) => {
      inputFocusVisible.value = openedByKeyboard;
      keyboardModality.value = openedByKeyboard;
    },
    { flush: 'sync' },
  );

  const {
    items: registeredItems,
    registerItem: registerInRegistry,
    liveItems,
  } = useItemRegistry<symbol, FilterDropdownItemRegistration>();

  const defaultId = useVaseUiId();
  const store = new FilterDropdownStore();

  // The count is published as items register, not with the next registry snapshot, so an empty
  // message mounting alongside the items never reads a stale zero.
  function registerItem(id: symbol, item: FilterDropdownItemRegistration) {
    const unregister = registerInRegistry(id, item);
    store.set('registeredItemCount', liveItems.size);
    return () => {
      unregister();
      store.set('registeredItemCount', liveItems.size);
    };
  }

  let lastFilterQuery: string | null = null;

  const open = computed(() => toValue(params.open));
  const disabled = computed(() => Boolean(toValue(params.disabled)));
  const autoHighlight = computed(() => toValue(params.autoHighlight) ?? false);
  const query = computed(() => toValue(params.query));
  const value = computed(() => query.value ?? toValue(params.value));
  const defaultMatchItem = computed<FilterDropdownFilter>(
    () => getFilter({ locale: toValue(params.locale) }).contains,
  );

  const focusOwnerRef = params.focusOwnerRef ?? shallowRef<HTMLElement | null>(null);
  const filterQuery = computed(() => value.value.trim());
  // An unused inline filter must not re-run auto-highlighting when the consumer re-renders.
  const matchItem = computed(() => {
    const filter = toValue(params.filter);
    return filterQuery.value === '' || filter === null ? null : (filter ?? defaultMatchItem.value);
  });
  const autoHighlightEnabled = computed(
    () =>
      open.value &&
      (autoHighlight.value === 'always' || (autoHighlight.value && filterQuery.value !== '')),
  );
  const defaultListId = computed(() => `${defaultId.value}-list`);
  const listId = computed(() => (renderedListId.value ?? defaultListId.value) || undefined);
  // The host owns the trigger. `null` and `''` both mean no element carries an id to point at.
  const triggerId = computed(() => toValue(params.triggerId) || undefined);

  function handleValueChange(
    nextValue: string,
    eventDetails: FilterDropdownRootChangeEventDetails,
  ) {
    onValueChange?.(nextValue, eventDetails);
    // Indexes are positional, so a kept highlight would land on whatever fills its slot.
    // With `autoHighlight`, the filtering effect below places the highlight instead.
    if (!eventDetails.isCanceled && !autoHighlight.value) {
      setActiveIndex(null);
    }
  }

  function handleItemsChange(previousItems: readonly (HTMLElement | null)[]) {
    const items = listRef.value;
    const activeIndex = getActiveIndex();

    // A positional highlight must not silently move to another item. A change that leaves the
    // highlighted item in place keeps it, such as an item appended after it or one that renders
    // once before the query filters it out. A query change already reset the highlight.
    if (
      activeIndex != null &&
      items[activeIndex] != null &&
      items[activeIndex] === previousItems[activeIndex]
    ) {
      return;
    }

    setActiveIndex(autoHighlightEnabled.value && items.length > 0 ? 0 : null);
  }

  // Runs at the mount, so the first query is recorded. Then it runs on the registry snapshot of
  // each flush, and on the committed query, because a controlled consumer can reject a proposed
  // change. It reads the live registry so items registered in this flush count before their
  // snapshot.
  function filterItems() {
    if (!open.value && query.value === undefined) {
      return;
    }

    const currentFilterQuery = filterQuery.value;
    const queryChanged = lastFilterQuery !== null && lastFilterQuery !== currentFilterQuery;
    lastFilterQuery = currentFilterQuery;

    const match = matchItem.value;
    // With no query or external filtering, every registered item is visible. External filtering
    // still follows `autoHighlight`; otherwise the item set invalidates the highlight.
    if (match === null) {
      store.set('visibleItemIds', null);
      // Registry updates, such as an item's text changing, keep the current highlight.
      if (autoHighlightEnabled.value && liveItems.size > 0) {
        if (queryChanged || getActiveIndex() == null) {
          setActiveIndex(0);
        }
      } else if (currentFilterQuery === '' && queryChanged) {
        setActiveIndex(null);
      }
      return;
    }

    const currentIds = store.state.visibleItemIds;
    // The popup's content mounts after the root opens. Publishing an empty result before
    // anything registered would hide every item as it arrives and remount the matches.
    if (currentIds === null && liveItems.size === 0) {
      return;
    }

    const nextIds = new Set<symbol>();
    let hasNewMatch = currentIds === null;
    liveItems.forEach(({ getText }, id) => {
      const text = getText();
      if (text != null && match(text, currentFilterQuery)) {
        nextIds.add(id);
        hasNewMatch ||= !currentIds?.has(id);
      }
    });

    // New matches or a smaller result set invalidate the previous item identities.
    if (hasNewMatch || currentIds?.size !== nextIds.size) {
      // The first filtered result has no prior result identity to invalidate, unless the
      // controlled query itself changed.
      if (autoHighlightEnabled.value && nextIds.size > 0) {
        setActiveIndex(0);
      } else if (currentIds !== null || queryChanged) {
        setActiveIndex(null);
      }
      store.set('visibleItemIds', nextIds);
    } else if (autoHighlightEnabled.value && queryChanged && nextIds.size > 0) {
      setActiveIndex(0);
    }
  }

  onMounted(filterItems);
  watch([open, query, filterQuery, registeredItems, matchItem, autoHighlightEnabled], filterItems);

  const rootContext: FilterDropdownRootContext = {
    open,
    disabled,
    inputFocusVisible,
    setInputFocusVisible(visible) {
      inputFocusVisible.value = visible;
    },
    keyboardModality,
    setKeyboardModality(nextKeyboardModality) {
      keyboardModality.value = nextKeyboardModality;
    },
    autoHighlight,
    triggerId,
    defaultListId,
    listId,
    setRenderedListId(id) {
      renderedListId.value = id;
    },
    focusOwnerRef,
    setActiveIndex,
    onItemsChange: handleItemsChange,
    onValueChange: handleValueChange,
  };

  const itemContext: FilterDropdownItemContext = {
    parent: parentItemContext,
    store,
    registerItem,
    listRef,
  };

  provide(FilterDropdownItemContext, itemContext);
  provide(FilterDropdownRootContext, rootContext);
  provide(FilterDropdownValueContext, value);

  return { rootContext, itemContext, value };
}

export interface UseFilterDropdownRootParameters {
  /**
   * Whether the popup is currently open.
   */
  open: MaybeRefOrGetter<boolean>;
  /** Whether the filter controls should be disabled. */
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /** Whether the popup opened from the keyboard, so the input starts with its focus ring. */
  openedByKeyboard?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Locale used for filtering comparisons.
   */
  locale?: MaybeRefOrGetter<Intl.LocalesArgument | undefined> | undefined;
  /**
   * The filter input value.
   */
  value: MaybeRefOrGetter<string>;
  /**
   * Query used for filtering when it differs from the input value, such as while closing.
   */
  query?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * Event handler called when the filter input value changes.
   */
  onValueChange?:
    ((value: string, eventDetails: FilterDropdownRootChangeEventDetails) => void) | undefined;
  /**
   * Custom filter logic used when filtering items. Pass `null` to turn filtering off.
   * A ref or a getter, because a plain function is the filter itself.
   */
  filter?:
    | Readonly<Ref<FilterDropdownFilter | null | undefined>>
    | (() => FilterDropdownFilter | null | undefined)
    | undefined;
  /** Whether the first matching item should be highlighted automatically. */
  autoHighlight?: MaybeRefOrGetter<boolean | 'always' | undefined> | undefined;
  /**
   * ID of a trigger rendered outside this root, which cannot register itself through the context.
   */
  triggerId?: MaybeRefOrGetter<string | null | undefined> | undefined;
  /**
   * The host's DOM-ordered list of item elements.
   */
  listRef: Readonly<Ref<readonly (HTMLElement | null)[]>>;
  /**
   * Reads the host's highlighted index.
   */
  getActiveIndex: () => number | null;
  /**
   * Moves the host's highlight.
   */
  setActiveIndex: (index: number | null) => void;
  /**
   * The host's ref for the input, which holds real focus while the list is navigated virtually.
   */
  focusOwnerRef?: Ref<HTMLElement | null> | undefined;
}

export interface UseFilterDropdownRootReturnValue {
  rootContext: FilterDropdownRootContext;
  itemContext: FilterDropdownItemContext;
  /** The query that the input shows. */
  value: ComputedRef<string>;
}
