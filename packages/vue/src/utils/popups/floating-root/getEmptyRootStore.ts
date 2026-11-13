import { NOOP } from '../../../common/empty';
import { createEventEmitter } from '../createEventEmitter';
import { NullStore } from '../NullStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import type { PositioningInteractionStore } from '../types';
import { floatingRootStoreSelectors } from './FloatingRootStore';
import type { FloatingRootState, FloatingRootStoreContext } from './FloatingRootStore';

/**
 * Gives a closed store with no anchor and no element, for a part that needs a store before the
 * real one exists, such as a positioner of Navigation Menu whose item has not opened yet.
 *
 * The store takes no write, and its state and its context are frozen. A module can thus hold it,
 * although all apps and all server requests share the module.
 */
export function getEmptyRootStore(): PositioningInteractionStore {
  const store = new NullStore<
    Readonly<FloatingRootState>,
    FloatingRootStoreContext,
    typeof floatingRootStoreSelectors
  >(
    Object.freeze({
      open: false,
      transitionStatus: undefined,
      anchorElement: null,
      positionerElement: null,
      anchorOverride: null,
      defaultPopupId: undefined,
    }),
    Object.freeze({
      onOpenChange: undefined,
      events: createEventEmitter(),
      nested: false,
      triggerElements: new PopupTriggerMap(),
    }),
    floatingRootStoreSelectors,
  );
  return Object.assign(store, { setOpen: NOOP, clearPositioning: NOOP });
}
