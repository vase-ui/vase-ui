import { computed, onMounted, onScopeDispose, onUpdated, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useFilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { DETACHED_OWNER } from '../store';

export interface UseFilterDropdownItemParameters {
  /**
   * A text representation of the item used for filtering. Falls back to the rendered text.
   */
  label?: MaybeRefOrGetter<string | undefined> | undefined;
  /**
   * Keeps the nearest group visible while this filtered-out item must remain mounted.
   */
  retainGroup?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * The dropdown that owns this item, when it isn't the nearest one. A filterable submenu's
   * trigger sits inside its own submenu's root but belongs to the enclosing list.
   */
  context?: FilterDropdownItemContext | null | undefined;
}

export interface UseFilterDropdownItemReturnValue {
  /**
   * Whether the item matches the current query and should render.
   */
  visible: ComputedRef<boolean>;
  /**
   * The function ref of the rendered element, used to read its text when no `label` is given.
   */
  ref: (element: HTMLElement | null) => void;
  /**
   * Takes the text of the slot of a filtered-out item, which has no element to read. The part
   * gives it to `FilterDropdownHiddenItemText`.
   */
  setHiddenText: (text: string) => void;
}

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 *
 * The item renders once before it is registered so its rendered text can be read and cached: a
 * popup can open with a query that already excludes the item, and a hidden item has no text left
 * to match against.
 *
 * Call it in `setup`. The part renders its element only while `visible` is `true`, and else
 * renders `FilterDropdownHiddenItemText` with its default slot.
 *
 * @internal
 */
export function useFilterDropdownItem(
  params: UseFilterDropdownItemParameters = {},
): UseFilterDropdownItemReturnValue {
  const { context } = params;

  const nearestContext = useFilterDropdownItemContext(context !== undefined);
  const groupContext = useFilterDropdownGroupContext();

  const owner = context === undefined ? nearestContext : context;
  const { registerItem, store } = owner ?? DETACHED_OWNER;

  const itemId = Symbol('filter-dropdown-item');
  let element: HTMLElement | null = null;
  let registeredText: string | undefined;
  // The text of the slot that the hidden item last gave, to tell whether it changed.
  let hiddenText: string | undefined;

  const matched = computed(() => store.select('isItemVisible', itemId));

  // An initial item is visible before registration (`visibleItemIds` is null), so start
  // registered and skip the mount re-render. A late item under an active filter starts
  // unregistered and renders once so its DOM text can be captured.
  const registered = shallowRef(matched.value);

  function resolveText() {
    const label = toValue(params.label);
    if (label != null) {
      return label;
    }
    // A filtered-out item has no DOM node left. Its slot is only a stand-in for the text it
    // renders, which can differ (a translation component, for example), so the cached text wins
    // unless the slot text changed.
    return element === null ? registeredText : (element.textContent ?? '');
  }

  function register(resolvedText?: string) {
    const text = resolvedText ?? resolveText();
    if (text) {
      registeredText = text;
    }
    return registerItem(itemId, {
      getText() {
        // A mounted item reports what it renders now, even nothing, since a descendant can change
        // its text without the item re-rendering. A filtered-out item falls back to the cached
        // text.
        if (toValue(params.label) == null && element !== null) {
          registeredText = element.textContent ?? '';
        }
        return registeredText;
      },
    });
  }

  let unregister: (() => void) | undefined;
  onMounted(() => {
    unregister = register();
    registered.value = true;
  });
  onScopeDispose(() => unregister?.());

  let unregisterFromGroup: (() => void) | undefined;
  function registerInGroup() {
    unregisterFromGroup?.();
    unregisterFromGroup = groupContext?.registerItem(itemId, Boolean(toValue(params.retainGroup)));
  }
  onMounted(registerInGroup);
  watch(() => Boolean(toValue(params.retainGroup)), registerInGroup);
  onScopeDispose(() => unregisterFromGroup?.());

  // Re-register when the item's text changes, so the active query runs again.
  function registerChangedText(text: string | undefined) {
    if (text !== registeredText) {
      registeredText = text;
      register(text);
    }
  }
  onUpdated(() => registerChangedText(resolveText()));
  watch(
    () => toValue(params.label),
    () => registerChangedText(resolveText()),
  );

  function setHiddenText(text: string) {
    const previousText = hiddenText;
    hiddenText = text;
    // The first text after the element goes away is only a baseline: the cached text of the
    // element wins until the slot text changes.
    if (previousText === undefined || text === previousText || toValue(params.label) != null) {
      return;
    }
    registerChangedText(text);
  }

  return {
    visible: computed(() => !registered.value || matched.value),
    ref(nextElement) {
      element = nextElement;
      if (nextElement !== null) {
        hiddenText = undefined;
      }
    },
    setHiddenText,
  };
}
