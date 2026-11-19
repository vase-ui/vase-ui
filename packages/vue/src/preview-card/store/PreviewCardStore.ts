import { NOOP } from '../../common/empty';
import { REASONS } from '../../internals/reasons';
import { updateInlineRectCoords } from '../positioner/PreviewCardPositionerContext';
import type { InlineRectCoordsRef } from '../positioner/PreviewCardPositionerContext';
import {
  NullStore,
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  getHoverPopupInstantType,
  popupStoreSelectors,
} from '../../utils/popups/usePopupRoot';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginMiddleware';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../utils/popups/usePopupRoot';
import type { PreviewCardRootChangeEventDetails } from '../root/PreviewCardRoot.vue';
import { CLOSE_DELAY } from '../utils/constants';

export type State<Payload> = PopupStoreState<Payload> & {
  instantType: 'dismiss' | 'focus' | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
  closeDelay: number;
};

export type Context = PopupStoreContext<PreviewCardRootChangeEventDetails> & {
  inlineRectCoordsRef: InlineRectCoordsRef;
};

const selectors = {
  ...popupStoreSelectors,
  instantType: (state: State<unknown>) => state.instantType,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
  closeDelay: (state: State<unknown>) => state.closeDelay,
};

type Selectors = typeof selectors;

/**
 * The members of the store that a detached trigger uses. The store of a root and the inert store of
 * a handle both have them, so a trigger reads the store that its handle gives now. `setOpen` of the
 * inert store does nothing.
 */
export type PreviewCardHandleStore<Payload> = Pick<
  PreviewCardStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen'
>;

export class PreviewCardStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  PreviewCardRootChangeEventDetails
> {
  constructor(initialState: Partial<State<Payload>>, defaultPopupId: string | undefined) {
    super(
      createInitialState<Payload>(initialState, defaultPopupId),
      createInitialContext(),
      selectors,
    );
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: PreviewCardRootChangeEventDetails,
  ) {
    const { inlineRectCoordsRef } = this.context;

    // Keep the coordinates of the hover, so that the card is positioned against the hovered line
    // of the link.
    const event = eventDetails.event;
    if (
      nextOpen &&
      eventDetails.reason === REASONS.triggerHover &&
      eventDetails.trigger &&
      'clientX' in event &&
      'clientY' in event &&
      inlineRectCoordsRef.current?.element !== eventDetails.trigger
    ) {
      updateInlineRectCoords(
        inlineRectCoordsRef,
        eventDetails.trigger,
        event.clientX,
        event.clientY,
      );
    }

    return getHoverPopupInstantType(nextOpen, eventDetails.reason);
  }

  protected override prepareUnmount() {
    this.context.inlineRectCoordsRef.current = undefined;
    return {};
  }
}

/**
 * Makes the inert store that a detached trigger reads while no root is attached to its handle. The
 * trigger registers in the trigger map of this store. It moves to the store of a root when the root
 * attaches.
 */
export function createNullPreviewCardStore<Payload>(): PreviewCardHandleStore<Payload> {
  const store = new NullStore<Readonly<State<Payload>>, Context, Selectors>(
    Object.freeze(createInitialState<Payload>(undefined)),
    Object.freeze(createInitialContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string,
): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    instantType: undefined,
    adaptiveOrigin: undefined,
    closeDelay: CLOSE_DELAY,
    ...initialState,
  };
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    inlineRectCoordsRef: { current: undefined },
  };
}
