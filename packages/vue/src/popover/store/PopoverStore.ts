import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { NOOP } from '../../common/empty';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import { Timeout } from '../../common/useTimeout';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { REASONS } from '../../internals/reasons';
import { NullStore } from '../../utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../utils/popups/positioning/adaptiveOriginConstants';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../../utils/popups/store';
import type {
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../utils/popups/store';
import type {
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
} from '../root/PopoverRoot.vue';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
  modal: boolean | 'trap-focus';
  focusManagerModal: boolean;
  openMethod: InteractionType | null;
  openChangeReason: PopoverRootChangeEventReason | null;
  titleElementId: string | undefined;
  descriptionElementId: string | undefined;
  openOnHover: boolean;
  closeDelay: number;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type Context = PopupStoreContext<PopoverRootChangeEventDetails> & {
  readonly triggerFocusTargetRef: ShallowRef<HTMLElement | null>;
  readonly beforeTriggerFocusGuardRef: ShallowRef<HTMLElement | null>;
  readonly beforeContentFocusGuardRef: ShallowRef<HTMLElement | null>;
  readonly stickIfOpenTimeout: Timeout;
  // Only a press of a trigger reads it, so it is not a part of the state.
  stickIfOpen: boolean;
};

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) => state.disabled,
  // `trigger-change` is for a popup that moves between triggers, so it has a meaning only while
  // the popup is open. A late write then does not make a popup that closes instant, which would
  // skip its exit transition. A controlled root that closes through the `open` prop does not pass
  // `setOpen`, so the selector is the only place that covers each close.
  instantType: (state: State<unknown>) =>
    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
      ? undefined
      : state.instantType,
  openMethod: (state: State<unknown>) => state.openMethod,
  openChangeReason: (state: State<unknown>) => state.openChangeReason,
  isPressOpenedByTrigger: (state: State<unknown>, triggerId: string | undefined) =>
    state.openChangeReason === REASONS.triggerPress &&
    popupStoreSelectors.isOpenedByTrigger(state, triggerId),
  // The selectors below give a constant to a trigger that does not use them. A change of the state
  // then does not render each inactive trigger again.
  isTouchPressOpen: (state: State<unknown>, openOnHover: boolean) =>
    openOnHover && state.openMethod === 'touch' && state.openChangeReason === REASONS.triggerPress,
  // A popover that hover opened has no focus manager, so the guards have nothing to send the focus
  // to. The Tab key then follows the order of the document.
  hasTriggerFocusGuards: (state: State<unknown>, triggerId: string | undefined) =>
    popupStoreSelectors.isOpenedByTrigger(state, triggerId) &&
    !state.focusManagerModal &&
    state.openChangeReason !== REASONS.triggerHover,
  modal: (state: State<unknown>) => state.modal,
  titleElementId: (state: State<unknown>) => state.titleElementId,
  descriptionElementId: (state: State<unknown>) => state.descriptionElementId,
  openOnHover: (state: State<unknown>) => state.openOnHover,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
};

type Selectors = typeof selectors;

/**
 * The view of the store that a detached trigger of a handle reads. The store of a root and the
 * inert store of a handle both fit it. It has the members that a trigger uses: the members for the
 * trigger data, and `setOpen`, which the interactions of a trigger call. On the inert store, each
 * write does nothing.
 */
export type PopoverHandleStore<Payload> = Pick<
  PopoverStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen'
>;

export class PopoverStore<Payload> extends BasePopupStore<
  State<Payload>,
  Context,
  Selectors,
  PopoverRootChangeEventDetails
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
    eventDetails: PopoverRootChangeEventDetails,
  ) {
    const reason = eventDetails.reason;

    if (reason === REASONS.triggerHover) {
      // Only a "patient" press closes a popover that hover opened. A press in the first 500 ms
      // after the open keeps the popover open.
      this.context.stickIfOpen = true;
      this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        this.context.stickIfOpen = false;
      });
    }

    let instantType: State<Payload>['instantType'];
    if (reason === REASONS.triggerPress && (eventDetails.event as MouseEvent).detail === 0) {
      instantType = 'click';
    } else if (!nextOpen && (reason === REASONS.escapeKey || reason == null)) {
      instantType = 'dismiss';
    } else if (reason === REASONS.focusOut) {
      instantType = 'focus';
    }

    return { instantType };
  }

  protected override prepareUnmount() {
    this.context.stickIfOpen = true;
    return { openChangeReason: null };
  }
}

/**
 * Makes the inert store that a detached trigger of a handle reads while no `Popover.Root` is
 * attached. Its context has a trigger map, so a detached trigger can register before it moves to
 * the store of a root. `setOpen` does nothing, so a trigger can give the store to its
 * interactions.
 */
export function createNullPopoverStore<Payload>(): PopoverHandleStore<Payload> {
  const store = new NullStore<Readonly<State<Payload>>, Context, Selectors>(
    Object.freeze(createInitialState<Payload>(undefined)),
    Object.freeze(createInitialContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

function createInitialState<Payload>(
  initialState: Partial<State<Payload>> | undefined,
  defaultPopupId?: string | undefined,
): State<Payload> {
  const state: State<Payload> = {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    disabled: false,
    modal: false,
    focusManagerModal: false,
    instantType: undefined,
    openMethod: null,
    openChangeReason: null,
    titleElementId: undefined,
    descriptionElementId: undefined,
    openOnHover: false,
    closeDelay: 0,
    adaptiveOrigin: undefined,
    ...initialState,
  };

  if (state.open && initialState?.mounted === undefined) {
    state.mounted = true;
  }

  return state;
}

function createInitialContext(): Context {
  return {
    ...createPopupStoreContext(),
    triggerFocusTargetRef: shallowRef<HTMLElement | null>(null),
    beforeTriggerFocusGuardRef: shallowRef<HTMLElement | null>(null),
    beforeContentFocusGuardRef: shallowRef<HTMLElement | null>(null),
    stickIfOpenTimeout: new Timeout(),
    stickIfOpen: true,
  };
}
