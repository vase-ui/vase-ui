import { toValue, useId, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { PopupTriggerMap } from '../popupTriggerMap';
import { useFloatingParentNodeId } from '../tree/FloatingTree';
import { FloatingRootStore } from './FloatingRootStore';
import type { FloatingRootState } from './FloatingRootStore';

/**
 * What `useFloatingRootStore` copies into its store.
 */
export interface UseFloatingRootStoreOptions {
  /**
   * Whether the popup is open. Positioning clears the anchor while the popup is not mounted. It
   * gives the anchor back only when `open` or `elements.anchor` changes, so `open` must follow
   * `mounted`.
   * @default false
   */
  open?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Called when an interaction composable requests an open change.
   */
  onOpenChange?(open: boolean, eventDetails: VaseUIChangeEventDetails<string>): void;
  /**
   * The elements to copy into the store. A source that gives `undefined` keeps the current value of
   * the store.
   */
  elements?:
    | {
        /**
         * The DOM element that the popup is anchored to. To position against a virtual element, give
         * it as the `anchor` option of `useAnchorPositioning`.
         */
        anchor?: MaybeRefOrGetter<Element | null | undefined>;
        /**
         * The positioner element of the popup, or the popup itself when it has no positioner.
         */
        positionerElement?: MaybeRefOrGetter<HTMLElement | null | undefined>;
      }
    | undefined;
}

/**
 * Makes a `FloatingRootStore` for a part that manages its open state without a popup store. A
 * `watch` copies the open state, the anchor and the positioner element into the store when a source
 * changes. The same `watch` updates the nesting flag.
 *
 * Call it in `setup`.
 */
export function useFloatingRootStore(options: UseFloatingRootStoreOptions): FloatingRootStore {
  const { open, onOpenChange, elements = {} } = options;

  const defaultPopupId = useId();
  const parentNodeId = useFloatingParentNodeId();

  const store = new FloatingRootStore({
    open: toValue(open) ?? false,
    onOpenChange,
    anchorElement: toValue(elements.anchor) ?? null,
    positionerElement: toValue(elements.positionerElement) ?? null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId,
    nested: parentNodeId.value !== null,
  });

  watch(
    [
      () => toValue(open) ?? false,
      () => toValue(elements.anchor),
      () => toValue(elements.positionerElement),
      () => parentNodeId.value !== null,
    ],
    ([nextOpen, anchorElement, positionerElement, nested]) => {
      store.context.nested = nested;

      // Each run writes all the values. `clearPositioning` can have cleared the anchor and the
      // elements since the last run, and a change of `open` must give them back.
      const values = { open: nextOpen } as Pick<
        FloatingRootState,
        'open' | 'anchorElement' | 'positionerElement'
      >;
      if (anchorElement !== undefined) {
        values.anchorElement = anchorElement;
      }
      if (positionerElement !== undefined) {
        values.positionerElement = positionerElement;
      }
      store.update(values);
    },
  );

  return store;
}
