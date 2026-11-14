import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { FilterDropdownRootChangeEventDetails } from './FilterDropdownRootContext';

interface UseFilterDropdownCloseQueryParameters {
  open: MaybeRefOrGetter<boolean>;
  mounted: MaybeRefOrGetter<boolean>;
  value: MaybeRefOrGetter<string>;
  onValueChange: (value: string, details: FilterDropdownRootChangeEventDetails) => void;
}

/**
 * Retains the displayed query and filtered items while a filter popup closes, and clears the
 * committed value once it has unmounted. The input lives inside the popup, so the value stays in
 * use until then: clearing it earlier would change whatever the consumer renders from it, such
 * as externally filtered items, while the popup animates out.
 *
 * Call it in `setup`.
 */
export function useFilterDropdownCloseQuery(
  parameters: UseFilterDropdownCloseQueryParameters,
): ComputedRef<string> {
  const { open, mounted, value, onValueChange } = parameters;

  const closeQuery = shallowRef<string | null>(null);

  let previousOpen = toValue(open);
  let pendingReset = false;

  function settlePendingReset() {
    pendingReset = false;
    if (toValue(value) !== '') {
      onValueChange('', createChangeEventDetails(REASONS.popupClose));
    }
  }

  watch(
    [() => toValue(open), () => toValue(mounted), () => toValue(value), closeQuery],
    ([isOpen, isMounted, currentValue]) => {
      const wasOpen = previousOpen;
      previousOpen = isOpen;
      if (wasOpen && !isOpen && currentValue !== '') {
        pendingReset = true;
        closeQuery.value = currentValue;
      } else if ((isOpen || !isMounted) && closeQuery.value !== null) {
        // A reopen that interrupts the exit never unmounts, so it settles the pending reset too.
        closeQuery.value = null;
        settlePendingReset();
      }
    },
  );

  onScopeDispose(() => {
    if (pendingReset) {
      settlePendingReset();
    }
  });

  return computed(() =>
    !toValue(open) && closeQuery.value !== null ? closeQuery.value : toValue(value),
  );
}
