import { computed, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { Placement } from '@floating-ui/vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useFloatingRootStore } from '../../src/utils/popups/floating-root/useFloatingRootStore';
import { useVaseUIFloating } from '../../src/utils/popups/positioning/useFloating';

/**
 * The test double of `useFloating` of Base UI. It makes a `FloatingRootStore` and calls
 * `useVaseUIFloating`, as a positioner does. The store and the node of the popup in the popup tree
 * then get the positioning context.
 */
export function useFloating(
  options: {
    open?: MaybeRefOrGetter<boolean | undefined>;
    onOpenChange?: (open: boolean, details: VaseUIChangeEventDetails<string>) => void;
    placement?: MaybeRefOrGetter<Placement | undefined>;
    nodeId?: string | undefined;
  } = {},
) {
  const reference = shallowRef<Element | null>(null);
  const floating = shallowRef<HTMLElement | null>(null);
  const rootStore = useFloatingRootStore({
    open: options.open,
    onOpenChange: options.onOpenChange,
    elements: { anchor: reference, positionerElement: floating },
  });
  useVaseUIFloating({
    rootStore,
    // The popup counts as mounted, so the store keeps its anchor and its positioner element.
    mounted: true,
    positioning: {
      placement: computed(() => toValue(options.placement) ?? 'bottom'),
      reference: computed(() => reference.value),
    },
    nodeId: options.nodeId,
  });

  return {
    refs: {
      reference,
      floating,
      setReference(element: unknown) {
        reference.value = element as Element | null;
      },
      setFloating(element: unknown) {
        floating.value = element as HTMLElement | null;
      },
    },
    context: { rootStore },
  };
}
