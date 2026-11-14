import { shallowRef, toRaw } from 'vue';
import type { HTMLAttributes, ShallowRef } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { createEventEmitter } from './createEventEmitter';
import { dispatchOpenChange } from './floating-root/dispatchOpenChange';
import { ReactiveStore } from './ReactiveStore';
import type { PopupEvents, PopupInteractionContext, ReferenceType } from './types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { PopupTriggerMap } from './popupTriggerMap';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * The state that all popup stores share.
 */
export type PopupStoreState<Payload> = {
  /**
   * Whether the popup is open. This is the internal state.
   * When `openProp` is set, this holds the last open change request instead. The root resets it
   * when `openProp` closes the popup.
   */
  open: boolean;
  /**
   * Whether the popup is open, as the `open` prop says.
   */
  readonly openProp: boolean | undefined;
  /**
   * Whether the popup is mounted in the DOM.
   * This usually follows `open`, but it differs during an exit transition.
   */
  mounted: boolean;
  /**
   * The state of the enter or exit transition of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The id of the popup, unless its element sets one.
   */
  defaultPopupId: string | undefined;
  /**
   * The number of trigger elements that are registered for the popup.
   */
  triggerCount: number;
  /**
   * Whether the popup stays mounted after it closes.
   * Use it for a JavaScript animation library that unmounts the popup itself.
   */
  preventUnmountingOnClose: boolean;

  /**
   * The payload that the active trigger gives.
   */
  payload: Payload | undefined;

  /**
   * The id of the active trigger.
   */
  activeTriggerId: string | null;
  /**
   * The element of the active trigger.
   */
  activeTriggerElement: Element | null;
  /**
   * The last trigger element that the popup was anchored to. Unlike `activeTriggerElement`, it
   * stays after the popup unmounts. The interaction composables then still know the trigger that
   * the popup last belonged to.
   */
  anchorElement: Element | null;
  /**
   * Whether a request that had no trigger opened the popup, such as `open(null)` or
   * `openWithPayload()` of a handle. While this is set, a lone registered trigger is not
   * associated with the popup. The state that the trigger owns, such as `payload`, is then not
   * forwarded. The root resets it when the popup is closed.
   */
  openedWithoutTrigger: boolean;
  /**
   * The reason for the last accepted open change.
   */
  openChangeReason: string | null;
  /**
   * The id of the trigger, as the `triggerId` prop says.
   */
  readonly triggerIdProp: string | null | undefined;
  /**
   * The element of the popup.
   */
  popupElement: HTMLElement | null;
  /**
   * The element of the positioner.
   */
  positionerElement: HTMLElement | null;
  /**
   * A virtual anchor that replaces the active trigger, such as the cursor position of a tooltip
   * that follows the cursor.
   */
  anchorOverride: ReferenceType | null;

  /**
   * The props of the active trigger element.
   */
  activeTriggerProps: HTMLAttributes;
  /**
   * The props of the inactive trigger elements.
   */
  inactiveTriggerProps: HTMLAttributes;
  /**
   * The props of the popup element.
   */
  popupProps: HTMLAttributes;
};

export function createInitialPopupStoreState<Payload>(
  defaultPopupId?: string,
): PopupStoreState<Payload> {
  return {
    open: false,
    openProp: undefined,
    mounted: false,
    transitionStatus: undefined,
    defaultPopupId,
    triggerCount: 0,
    preventUnmountingOnClose: false,
    payload: undefined,
    activeTriggerId: null,
    activeTriggerElement: null,
    anchorElement: null,
    openedWithoutTrigger: false,
    openChangeReason: null,
    triggerIdProp: undefined,
    popupElement: null,
    positionerElement: null,
    anchorOverride: null,
    activeTriggerProps: EMPTY_OBJECT,
    inactiveTriggerProps: EMPTY_OBJECT,
    popupProps: EMPTY_OBJECT,
  };
}

export type PopupStoreContext<ChangeEventDetails> = PopupInteractionContext & {
  /**
   * The registered trigger elements.
   */
  readonly triggerElements: PopupTriggerMap;
  /**
   * A ref to the element of the popup.
   */
  readonly popupRef: ShallowRef<HTMLElement | null>;
  /**
   * Called when the open state changes.
   */
  onOpenChange?: ((open: boolean, eventDetails: ChangeEventDetails) => void) | undefined;
  /**
   * Called when the animation of an open state change ends.
   */
  onOpenChangeComplete: ((open: boolean) => void) | undefined;
  /**
   * The internal events of the interaction composables, such as `openchange`.
   */
  readonly events: PopupEvents;
  /**
   * Whether the popup has a parent popup in the floating tree.
   */
  nested: boolean;
};

/**
 * Makes the context that each popup store starts with. It includes the values that the interaction
 * composables share.
 */
export function createPopupStoreContext() {
  return {
    popupRef: shallowRef<HTMLElement | null>(null),
    triggerElements: new PopupTriggerMap(),
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    events: createEventEmitter(),
    nested: false,
  };
}

type S = PopupStoreState<unknown>;

const activeTriggerIdSelector = (state: S) => state.triggerIdProp ?? state.activeTriggerId;

const openSelector = (state: S) => state.openProp ?? state.open;

const activeTriggerElementSelector = (state: S) =>
  state.mounted ? state.activeTriggerElement : null;

const popupIdSelector = (state: S) => {
  const popupId = state.popupElement?.id ?? state.defaultPopupId;
  return popupId || undefined;
};

function triggerOwnsOpenPopup(state: S, triggerId: string | undefined) {
  return (
    triggerId !== undefined && openSelector(state) && activeTriggerIdSelector(state) === triggerId
  );
}

function triggerOwnsOpenPopupOrIsOnlyTrigger(state: S, triggerId: string | undefined) {
  if (triggerOwnsOpenPopup(state, triggerId)) {
    return true;
  }

  return (
    triggerId !== undefined &&
    openSelector(state) &&
    activeTriggerIdSelector(state) == null &&
    !state.openedWithoutTrigger &&
    state.triggerCount === 1
  );
}

export const popupStoreSelectors = {
  open: openSelector,
  mounted: (state: S) => state.mounted,
  // A write of `open` comes before the write of `mounted` and `transitionStatus`. This selector
  // then gives `'starting'`, as `useTransitionStatus` does. Thus a popup that stays mounted does
  // not miss its `'starting'` status.
  transitionStatus: (state: S) =>
    openSelector(state) && !state.mounted ? 'starting' : state.transitionStatus,
  triggerCount: (state: S) => state.triggerCount,
  preventUnmountingOnClose: (state: S) => state.preventUnmountingOnClose,
  payload: (state: S) => state.payload,

  activeTriggerId: activeTriggerIdSelector,
  activeTriggerElement: activeTriggerElementSelector,
  popupId: popupIdSelector,
  /**
   * Whether the trigger with the given id opened the popup.
   */
  isTriggerActive: (state: S, triggerId: string | undefined) =>
    triggerId !== undefined && activeTriggerIdSelector(state) === triggerId,
  /**
   * Whether the popup is open and the trigger with the given id activated it.
   */
  isOpenedByTrigger: (state: S, triggerId: string | undefined) =>
    triggerOwnsOpenPopup(state, triggerId),
  /**
   * Whether the popup is mounted and the trigger with the given id activated it.
   */
  isMountedByTrigger: (state: S, triggerId: string | undefined) =>
    triggerId !== undefined && activeTriggerIdSelector(state) === triggerId && state.mounted,
  triggerProps: (state: S, isActive: boolean) =>
    isActive ? state.activeTriggerProps : state.inactiveTriggerProps,
  /**
   * The popup id for the trigger that owns the open popup.
   */
  triggerPopupId: (state: S, triggerId: string | undefined) =>
    triggerOwnsOpenPopupOrIsOnlyTrigger(state, triggerId) ? popupIdSelector(state) : undefined,
  popupProps: (state: S) => state.popupProps,

  popupElement: (state: S) => state.popupElement,
  // The selector gives a `keepMounted` positioner while the popup is closed. It gives nothing while
  // the popup is open but not mounted, because the positioner is still hidden. If not, the
  // interaction composables focus or measure the positioner before it shows.
  positionerElement: (state: S) =>
    openSelector(state) && !state.mounted ? null : state.positionerElement,

  // Reads of the store of the interaction composables (`PopupInteractionStore`).
  defaultPopupId: (state: S) => state.defaultPopupId,
  anchorElement: (state: S) => state.anchorElement,
  anchor: (state: S) => state.anchorOverride ?? activeTriggerElementSelector(state),
};

/**
 * Applies the result of a change of the trigger that anchors the popup. The new trigger becomes the
 * anchor element. An anchor override that followed the old trigger follows the new trigger.
 */
function syncAnchorState<State extends S>(previous: State, next: State): State {
  const previousAnchor = activeTriggerElementSelector(previous);
  const nextAnchor = activeTriggerElementSelector(next);

  if (previousAnchor === nextAnchor) {
    return next;
  }

  const followsAnchor =
    next.anchorOverride === previous.anchorOverride && previous.anchorOverride === previousAnchor;

  return {
    ...next,
    anchorElement: nextAnchor ?? next.anchorElement,
    anchorOverride: followsAnchor ? nextAnchor : next.anchorOverride,
  };
}

export type PopupStoreSelectors = typeof popupStoreSelectors;

type PopupOpenState = Pick<
  PopupStoreState<unknown>,
  | 'open'
  | 'preventUnmountingOnClose'
  | 'activeTriggerId'
  | 'activeTriggerElement'
  | 'openedWithoutTrigger'
>;

export function createPopupOpenState(
  state: S,
  open: boolean,
  trigger: Element | undefined,
  preventUnmountOnClose: boolean,
): PopupOpenState {
  // A request to stay mounted lasts until the popup opens again. A later close does not drop it.
  const preventUnmountingOnClose =
    !open && (state.preventUnmountingOnClose || preventUnmountOnClose);

  const triggerId = trigger?.id ?? null;
  // A controlled `triggerId` can move the popup to another trigger and leave the stored id as it
  // is. The kept id is thus the id that the popup resolves now.
  let activeTriggerId = activeTriggerIdSelector(state);
  let activeTriggerElement = state.activeTriggerElement;

  // A close keeps the active trigger when it names no trigger or names the active trigger. Exit
  // animations then play, and focus returns to the trigger. The active id can differ from the `id`
  // of the element after the root matches the element to its registered trigger id.
  if (open || (triggerId && trigger !== state.activeTriggerElement)) {
    activeTriggerId = triggerId;
    activeTriggerElement = trigger ?? null;
  }

  return {
    open,
    preventUnmountingOnClose,
    activeTriggerId,
    activeTriggerElement,
    // An open request with no trigger, such as `open(null)` or `openWithPayload()` of a handle,
    // must not join a lone registered trigger later. A controlled open and a default open do not
    // pass here, so they still claim a lone trigger. A close request keeps the flag. A controlled
    // root can decline the close and stay open, so the root clears the flag when the popup is
    // closed.
    openedWithoutTrigger: open ? trigger == null : state.openedWithoutTrigger,
  };
}

/**
 * The change event details that a popup gives to `onOpenChange`.
 */
export type PopupOpenChangeEventDetails = VaseUIChangeEventDetails<string> & {
  preventUnmountOnClose(): void;
};

/**
 * The state that a popup store commits with an accepted open change, in addition to the open state
 * that all popups commit.
 */
export type PopupOpenChangeState<State extends PopupStoreState<unknown>> = Partial<
  Omit<State, keyof PopupOpenState | 'openChangeReason'>
>;

/**
 * The state that a popup store resets after its popup unmounts, in addition to the fields that all
 * popups reset.
 */
export type PopupUnmountState<State extends PopupStoreState<unknown>> = Partial<
  Omit<State, PopupUnmountKey>
>;

type PopupUnmountKey =
  'activeTriggerId' | 'activeTriggerElement' | 'mounted' | 'preventUnmountingOnClose';

/**
 * The store of a popup root. It holds the state that all popups share and runs each open change in
 * the same order:
 *
 * 1. The store drops a close request while the popup is closed, and `isOpenChangeIgnored` can drop
 *    any other change. `onOpenChange` does not hear about a dropped change. A dropped close
 *    still cancels a hover open that waits.
 * 2. `getCloseTrigger` can name the trigger for a close request that has none.
 * 3. The store adds `preventUnmountOnClose()` to the event details.
 * 4. The store calls `onOpenChange`, which can cancel the change.
 * 5. A canceled change goes no further.
 * 6. The interaction composables hear about the change.
 * 7. `prepareOpenChange` runs the side effects of the store and returns its extra state.
 * 8. One update commits the change. It is the last step, and Vue writes the DOM in the next flush.
 *    A caller that reads the DOM after the change awaits `nextTick()`.
 *
 * `onOpenChange` hears only about changes that can happen. A change that the store does not commit
 * belongs in step 1, so that the store drops it before it reports the change. The last request of
 * a controlled popup is its state until the `open` prop changes. A close after an open that the
 * parent declined without `cancel()` is thus still reported. A store can drop more changes in step
 * 1 with `isOpenChangeIgnored`, as Menu and Combobox do.
 *
 * After the popup finishes its close and unmounts, `resetOnUnmount` clears what the open session
 * left behind, and the fields that `prepareUnmount` names.
 *
 * Each popup store overrides only the steps where it differs.
 */
export abstract class BasePopupStore<
  State extends PopupStoreState<unknown>,
  Context extends PopupStoreContext<ChangeEventDetails>,
  Selectors extends Record<string, (state: Readonly<State>, ...args: any[]) => any>,
  ChangeEventDetails extends PopupOpenChangeEventDetails,
> extends ReactiveStore<Readonly<State>, Context, Selectors> {
  // A new object for each open. A close uses it to know if the popup opened again since.
  private openSession = {};

  /**
   * Writes the state in two passes. The first pass writes each key except `open` and `openProp`.
   * The second pass writes those two keys. A sync watcher of the open state then reads the trigger
   * and the reason of the change that it reports.
   */
  override setState(newState: Readonly<State>): void {
    const current = toRaw(this.state);
    // A request or an `open` prop that opens the popup starts a new open session. An open request
    // that a controlled `open` prop did not apply does not start one. A close that waits for the
    // parent then keeps its request.
    if (!openSelector(current) && openSelector(newState)) {
      this.openSession = {};
    }
    const next = this.anchorsToActiveTrigger() ? syncAnchorState(current, newState) : newState;

    super.setState({ ...next, open: current.open, openProp: current.openProp });
    // A sync watcher can write the store in the first pass. This pass starts from the state of now,
    // so that it keeps that write.
    super.setState({ ...toRaw(this.state), open: next.open, openProp: next.openProp });
  }

  /**
   * Whether the popup anchors to the trigger that opened it. A store that keeps its anchor in
   * `anchorElement` itself turns this off.
   */
  protected anchorsToActiveTrigger(): boolean {
    return true;
  }

  /**
   * Clears the anchor element and the anchor override. The popup keeps the active trigger element
   * and the positioner element in other keys of its state, so they stay.
   */
  clearPositioning() {
    this.update({ anchorElement: null, anchorOverride: null });
  }

  setOpen = (
    nextOpen: boolean,
    eventDetails: Omit<ChangeEventDetails, 'preventUnmountOnClose'>,
  ): void => {
    const details = eventDetails as ChangeEventDetails;
    const state = toRaw(this.state);

    // A controlled popup can hold a request that the `open` prop did not apply yet. A close is thus
    // dropped only when `open` and `openProp` are both closed. A hover open can still wait, so the
    // hover interaction hears about the dropped close and cancels the open.
    if (!nextOpen && !state.open && !state.openProp) {
      this.context.events.emit('droppedclose');
      return;
    }

    if (this.isOpenChangeIgnored(nextOpen, details)) {
      return;
    }

    if (!nextOpen && details.trigger == null) {
      const closeTrigger = this.getCloseTrigger();
      // A trigger that left the document, such as a trigger whose unmount closes the popup, is not
      // reported.
      details.trigger = closeTrigger?.isConnected ? closeTrigger : undefined;
    }

    let preventUnmountOnClose = false;
    // The open session in which this close commits. It stays unset until the close commits. It is
    // never set for an open or for a canceled close.
    let closeSession: object | undefined;
    details.preventUnmountOnClose = () => {
      preventUnmountOnClose = true;
      // A call after the close commits, such as after an `await` in `onOpenChange`, still applies
      // until the popup opens again. More closes can commit in the meantime. A controlled `open`
      // prop can lag behind the close.
      if (closeSession === this.openSession) {
        this.set('preventUnmountingOnClose', true);
      }
    };

    this.context.onOpenChange?.(nextOpen, details);

    if (details.isCanceled) {
      return;
    }

    dispatchOpenChange(this.context, popupStoreSelectors.open(state), nextOpen, details);

    const extraState = this.prepareOpenChange(nextOpen, details);

    if (!nextOpen) {
      closeSession = this.openSession;
    }

    this.update({
      ...extraState,
      ...createPopupOpenState(state, nextOpen, details.trigger, preventUnmountOnClose),
      openChangeReason: details.reason,
    } as Pick<State, keyof State>);
  };

  /**
   * Whether to drop an open change before `onOpenChange` hears about it.
   */
  protected isOpenChangeIgnored(_nextOpen: boolean, _eventDetails: ChangeEventDetails): boolean {
    return false;
  }

  /**
   * Gives the trigger to report for a close request that has none. It is the trigger that the popup
   * is open from.
   */
  protected getCloseTrigger(): Element | null | undefined {
    const state = toRaw(this.state);
    const activeTriggerId = activeTriggerIdSelector(state);
    if (activeTriggerId == null) {
      return undefined;
    }

    return (
      this.context.triggerElements.getById(activeTriggerId) ?? activeTriggerElementSelector(state)
    );
  }

  /**
   * Runs the side effects of the store for an accepted open change. It returns the state to commit
   * with the change.
   */
  protected prepareOpenChange(
    _nextOpen: boolean,
    _eventDetails: ChangeEventDetails,
  ): PopupOpenChangeState<State> {
    return {};
  }

  /**
   * Clears what the open session left behind, after the popup finishes its close and unmounts.
   */
  resetOnUnmount(): void {
    // A trigger press during the exit writes the pressed trigger and `open: true` to the store. A
    // controlled `open` prop can lag behind, and the exit can complete before the prop catches up.
    // The root resets `open` when the prop closes the popup. Thus `open: true` here is a request
    // that came after that reset. Keep the trigger of that request.
    const unmountState: Partial<Pick<PopupStoreState<unknown>, PopupUnmountKey>> = {
      mounted: false,
      preventUnmountingOnClose: false,
    };
    if (!toRaw(this.state).open) {
      unmountState.activeTriggerId = null;
      unmountState.activeTriggerElement = null;
    }
    this.update({ ...this.prepareUnmount(), ...unmountState } as Pick<State, keyof State>);
  }

  /**
   * Runs the own cleanup of the store after the popup unmounts. It returns the state to reset with
   * the cleanup.
   */
  protected prepareUnmount(): PopupUnmountState<State> {
    return {};
  }
}

/**
 * Gives the `instantType` of a popup that opens on hover, such as a tooltip or a preview card. An
 * open on focus, and a close with the trigger or Escape, skip the transition. A hover change plays
 * it.
 */
export function getHoverPopupInstantType(
  nextOpen: boolean,
  reason: string,
): { instantType?: 'dismiss' | 'focus' | undefined } {
  if (nextOpen && reason === REASONS.triggerFocus) {
    return { instantType: 'focus' };
  }
  if (!nextOpen && (reason === REASONS.triggerPress || reason === REASONS.escapeKey)) {
    return { instantType: 'dismiss' };
  }
  if (reason === REASONS.triggerHover) {
    return { instantType: undefined };
  }
  return {};
}

/**
 * The store members that a detached trigger of a handle reads or calls to register itself and to
 * give its data. `set` and `update` are here only for the trigger count and the trigger data. On a
 * detached inert store they do nothing, so a write through them does not last. The handle store
 * type of each family picks these keys from its concrete store and keeps its context and
 * selectors. It adds the members that its triggers call, such as `setOpen`.
 */
export type PopupTriggerStoreKeys = 'context' | 'select' | 'set' | 'state' | 'update';

/**
 * The part of a popup store that a trigger uses to register itself and to give its data. It is
 * narrow, so a detached trigger can use an inert store.
 */
export type PopupTriggerDataStore<State extends PopupStoreState<unknown>> = Pick<
  ReactiveStore<Readonly<State>, PopupStoreContext<never>, PopupStoreSelectors>,
  PopupTriggerStoreKeys
>;
