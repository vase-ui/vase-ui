import { shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { Placement } from '@floating-ui/vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { useFloatingRootStore } from '../../src/utils/popups/floating-root/useFloatingRootStore';

/**
 * The test double of `useFloating` of Base UI. It makes a `FloatingRootStore` and does the work of
 * a positioner, which writes the positioning context of the store.
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
  rootStore.context.positioning = {
    get open() {
      return toValue(options.open) ?? false;
    },
    get placement() {
      return toValue(options.placement) ?? 'bottom';
    },
    nodeId: options.nodeId,
    get elements() {
      return {
        reference: reference.value,
        domReference: reference.value,
        floating: floating.value,
      };
    },
    rootStore,
  };

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
