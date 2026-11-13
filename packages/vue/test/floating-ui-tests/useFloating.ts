import { computed, shallowRef, toValue } from 'vue';
import type { ComponentPublicInstance, MaybeRefOrGetter } from 'vue';
import type { Placement } from '@floating-ui/vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { resolveElement } from '../../src/internals/resolveElement';
import type { FloatingRootStore } from '../../src/utils/popups/floating-root/FloatingRootStore';
import { useFloatingRootStore } from '../../src/utils/popups/floating-root/useFloatingRootStore';
import { useVaseUIFloating } from '../../src/utils/popups/positioning/useFloating';
import type { PopupPositioningContext } from '../../src/utils/popups/types';

interface UseFloatingOptions {
  /**
   * Whether the popup is open.
   */
  open?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Called when an interaction composable requests an open change.
   */
  onOpenChange?(open: boolean, eventDetails: VaseUIChangeEventDetails<string>): void;
  /**
   * The placement that the positioning context reports.
   * @default 'bottom'
   */
  placement?: MaybeRefOrGetter<Placement | undefined>;
  /**
   * Unique node id when using `FloatingTree`.
   */
  nodeId?: string | undefined;
}

/**
 * Floating UI's public `useFloating`: `refs.setReference` and `refs.setFloating` also register the
 * elements in the root store. Base UI components hand their elements to the store directly, so
 * only the ported Floating UI tests use this. It makes the positioning context and computes no
 * position.
 */
export function useFloating(options: UseFloatingOptions = {}) {
  const reference = shallowRef<Element | null>(null);
  const floating = shallowRef<HTMLElement | null>(null);

  const rootStore = useFloatingRootStore({
    open: options.open,
    onOpenChange: options.onOpenChange,
    elements: { anchor: reference, positionerElement: floating },
  });

  const context = useVaseUIFloating({
    rootStore,
    mounted: true,
    nodeId: options.nodeId,
    positioning: {
      placement: computed(() => toValue(options.placement) ?? 'bottom'),
      reference: computed(() => rootStore.select('anchor')),
    },
  });

  return {
    refs: {
      reference,
      floating,
      setReference(node: unknown) {
        reference.value = resolveElement(node as Element | ComponentPublicInstance | null);
      },
      setFloating(node: unknown) {
        floating.value = resolveElement(
          node as Element | ComponentPublicInstance | null,
        ) as HTMLElement | null;
      },
    },
    // The store of the context is the store made above.
    context: context as PopupPositioningContext & { rootStore: FloatingRootStore },
  };
}
