import { toRaw } from 'vue';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { TransitionStatus } from '../../../internals/useTransitionStatus';
import { createEventEmitter } from '../createEventEmitter';
import type { PopupTriggerMap } from '../popupTriggerMap';
import { ReactiveStore } from '../ReactiveStore';
import type { PopupInteractionContext, PositioningInteractionStore, ReferenceType } from '../types';
import { dispatchOpenChange } from './dispatchOpenChange';

/**
 * The state of a `FloatingRootStore`. The part that owns the store gives each value.
 */
export interface FloatingRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup. The owner does not give it, so it stays `undefined`.
   */
  transitionStatus: TransitionStatus | undefined;
  /**
   * The anchor element that the owner gives, usually its trigger. `clearPositioning` clears it
   * while the popup is not mounted.
   */
  anchorElement: Element | null;
  /**
   * The positioner element of the popup, or the popup itself when it has no positioner.
   */
  positionerElement: HTMLElement | null;
  /**
   * An anchor that is set explicitly, such as the cursor position of a popup that follows it.
   */
  anchorOverride: ReferenceType | null;
  /**
   * The id of the popup, unless its element sets one.
   */
  defaultPopupId: string | undefined;
}

/**
 * The plain context of a `FloatingRootStore`: the values that the interaction composables share,
 * and the open change callback of the owner.
 */
export interface FloatingRootStoreContext extends PopupInteractionContext {
  /**
   * Called after an open change goes to the interaction composables, so that the owner can update
   * its own open state.
   */
  onOpenChange:
    ((open: boolean, eventDetails: VaseUIChangeEventDetails<string>) => void) | undefined;
}

export const floatingRootStoreSelectors = {
  open: (state: FloatingRootState) => state.open,
  transitionStatus: (state: FloatingRootState) => state.transitionStatus,
  anchorElement: (state: FloatingRootState) => state.anchorElement,
  anchor: (state: FloatingRootState) => state.anchorOverride ?? state.anchorElement,
  positionerElement: (state: FloatingRootState) => state.positionerElement,
  defaultPopupId: (state: FloatingRootState) => state.defaultPopupId,
};

interface FloatingRootStoreOptions {
  open: boolean;
  anchorElement: Element | null;
  positionerElement: HTMLElement | null;
  triggerElements: PopupTriggerMap;
  defaultPopupId: string | undefined;
  nested: boolean;
  onOpenChange:
    ((open: boolean, eventDetails: VaseUIChangeEventDetails<string>) => void) | undefined;
}

/**
 * The interaction store of a part that has no popup store, such as Navigation Menu and Toast. It
 * holds a copy of the open state, the anchor and the elements of its owner. `useFloatingRootStore`
 * keeps the copy up to date. The store reports an open change to the owner through `onOpenChange`,
 * and it does not write `open` itself.
 */
export class FloatingRootStore
  extends ReactiveStore<
    Readonly<FloatingRootState>,
    FloatingRootStoreContext,
    typeof floatingRootStoreSelectors
  >
  implements PositioningInteractionStore
{
  constructor(options: FloatingRootStoreOptions) {
    const { nested, onOpenChange, triggerElements, ...initialState } = options;

    super(
      { ...initialState, transitionStatus: undefined, anchorOverride: null },
      {
        onOpenChange,
        events: createEventEmitter(),
        nested,
        triggerElements,
      },
      floatingRootStoreSelectors,
    );
  }

  /**
   * Emits the `openchange` event of the interaction composables. Then it calls `onOpenChange`.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that caused the change.
   */
  setOpen = (newOpen: boolean, eventDetails: VaseUIChangeEventDetails<string>) => {
    dispatchOpenChange(this.context, toRaw(this.state).open, newOpen, eventDetails);
    this.context.onOpenChange?.(newOpen, eventDetails);
  };

  /**
   * Clears the anchor and the elements that positioning reads while the popup is not mounted, so
   * that positioning does not run for a closed `keepMounted` popup.
   */
  clearPositioning() {
    this.update({
      positionerElement: null,
      anchorElement: null,
      anchorOverride: null,
    });
  }
}
