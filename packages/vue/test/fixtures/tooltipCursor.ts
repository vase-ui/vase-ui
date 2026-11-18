import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useTooltipCursor } from '../../src/tooltip/root/TooltipRoot.vue';
import type { PopupInteractionStore, ReferenceType } from '../../src/utils/popups/types';

export function useTestCursor(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  options?: Parameters<typeof useTooltipCursor>[1],
) {
  const owner = computed(() => {
    const current = toValue(store);
    return {
      get open() {
        return current.select('open');
      },
      get positioner() {
        return current.select('positionerElement');
      },
      get anchor() {
        return current.select('anchorElement');
      },
      context: current.context,
      setAnchor: (anchor: ReferenceType | null) => current.set('anchorOverride', anchor),
    };
  });
  return useTooltipCursor(owner, options);
}
