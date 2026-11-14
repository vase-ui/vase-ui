import { computed, onMounted, onScopeDispose, provide, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { useItemRegistry } from '../../internals/useItemRegistry';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { State as StoreState } from '../store';
import {
  FilterDropdownGroupContext,
  useFilterDropdownGroupContext,
} from './FilterDropdownGroupContext';

function isGroupHidden(state: StoreState, items: ReadonlyMap<symbol, boolean>) {
  // A group with no members hasn't been filtered out, it hasn't registered yet.
  if (state.visibleItemIds === null || items.size === 0) {
    return false;
  }
  for (const [id, retained] of items) {
    if (retained || state.visibleItemIds.has(id)) {
      return false;
    }
  }
  return true;
}

export interface UseFilterDropdownGroupReturnValue {
  /**
   * Whether the query filtered out every item in the group, so its label doesn't linger over an
   * empty section.
   */
  hidden: ComputedRef<boolean>;
}

/**
 * Tracks which items belong to a group and hides the group once none of them match.
 * It provides the group context that collects the items of the group. Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownGroup(): UseFilterDropdownGroupReturnValue {
  const { store } = useFilterDropdownItemContext();
  const parentContext = useFilterDropdownGroupContext();

  const { items, registerItem } = useItemRegistry<symbol, boolean>();
  const hidden = computed(() => isGroupHidden(store.state, items.value));

  // A nested container collects its own items, so the enclosing one only ever sees this
  // registration. Report visibility upward or a group of groups would look empty.
  const groupId = Symbol('filter-dropdown-group');
  let unregisterInParent: (() => void) | undefined;

  function registerInParent() {
    unregisterInParent?.();
    unregisterInParent = parentContext?.registerItem(groupId, !hidden.value);
  }

  onMounted(registerInParent);
  watch(hidden, registerInParent);
  onScopeDispose(() => unregisterInParent?.());

  provide(FilterDropdownGroupContext, { registerItem });

  return { hidden };
}
