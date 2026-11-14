import { toRaw } from 'vue';
import { NOOP } from '../../common/empty';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { dispatchOpenChange } from '../../utils/popups/floating-root/dispatchOpenChange';
import { NullStore } from '../../utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  getHoverPopupInstantType,
  popupStoreSelectors,
} from '../../utils/popups/store';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../utils/popups/store';
import type {
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
} from '../root/TooltipRoot.vue';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'delay' | 'dismiss' | 'focus' | undefined;
  isInstantPhase: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
  disableHoverablePopup: boolean;
  openChangeReason: TooltipRootChangeEventReason | null;
  closeOnClick: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

export type Context = PopupStoreContext<TooltipRootChangeEventDetails>;

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) => state.disabled,
  instantType: (state: State<unknown>) => state.instantType,
  isInstantPhase: (state: State<unknown>) => state.isInstantPhase,
  trackCursorAxis: (state: State<unknown>) => state.trackCursorAxis,
  disableHoverablePopup: (state: State<unknown>) => state.disableHoverablePopup,
  lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
  closeOnClick: (state: State<unknown>) => state.closeOnClick,
  // The props of the active trigger and of the other triggers are the same object. A trigger that
  // does not apply them reads a constant, so it does not render again when the props change.
  appliedTriggerProps: (state: State<unknown>, apply: boolean) =>
    apply ? state.activeTriggerProps : undefined,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The part of the store that a trigger uses. The store of a root and the inert store of a handle
 * both fit it. A trigger calls `setOpen` and `cancelPendingOpen`, and the delay group calls
 * `closeForSibling`. On the inert store, these three methods do nothing.
 */
export type TooltipHandleStore<Payload> = Pick<
  TooltipStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen' | 'cancelPendingOpen' | 'closeForSibling'
>;

export class TooltipStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  TooltipRootChangeEventDetails
> {
  constructor(initialState: Partial<State<Payload>>, defaultPopupId: string | undefined) {
    super(
      createInitialState<Payload>(initialState, defaultPopupId),
      createPopupStoreContext(),
      selectors,
    );
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: TooltipRootChangeEventDetails,
  ) {
    return getHoverPopupInstantType(nextOpen, eventDetails.reason);
  }

  /**
   * Closes the tooltip because another tooltip of its delay group opened. A tooltip in its exit
   * transition records the reason, so `Tooltip.Root` can skip the rest of that transition. The
   * delay group keeps this function and calls it later, so it is an arrow function.
   */
  closeForSibling = () => {
    const state = toRaw(this.state);
    if (!popupStoreSelectors.open(state) && state.mounted) {
      this.set('openChangeReason', REASONS.none);
    }
    this.setOpen(false, createChangeEventDetails(REASONS.none));
  };

  /**
   * Cancels a hover open that waits for its delay. A press of a trigger calls it. It does not call
   * `onOpenChange`, because the open state does not change.
   */
  cancelPendingOpen(event: MouseEvent | PointerEvent) {
    dispatchOpenChange(
      this.context,
      popupStoreSelectors.open(toRaw(this.state)),
      false,
      createChangeEventDetails(REASONS.triggerPress, event),
    );
  }
}

/**
 * Makes the inert store that a detached trigger uses while no `Tooltip.Root` is attached. The store
 * has a trigger map, so the trigger can register before it moves to the store of a root.
 * `setOpen`, `cancelPendingOpen` and `closeForSibling` do nothing, so the trigger can call them.
 */
export function createNullTooltipStore<Payload>(): TooltipHandleStore<Payload> {
  const store = new NullStore<Readonly<State<Payload>>, Context, Selectors>(
    Object.freeze(createInitialState<Payload>(undefined)),
    Object.freeze(createPopupStoreContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP, cancelPendingOpen: NOOP, closeForSibling: NOOP });
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    instantType: undefined,
    isInstantPhase: false,
    trackCursorAxis: 'none',
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}
