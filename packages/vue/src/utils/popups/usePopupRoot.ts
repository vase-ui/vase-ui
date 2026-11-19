import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { FloatingUIOpenChangeDetails } from '../../internals/types';
import { isClickLikeEvent } from './event';
import type { PopupInteractionContext, PopupEvents, ReferenceType } from './types';
import { ReactiveStore } from './handleStoreAdapter';
import type { SelectorFunction } from './handleStoreAdapter';
import {
  shallowRef,
  toRaw,
  computed,
  inject,
  onMounted,
  onScopeDispose,
  provide,
  toValue,
  watch,
} from 'vue';
import type { HTMLAttributes, ShallowRef, MaybeRefOrGetter, Ref } from 'vue';
import type { usePopupAutoResize } from './viewport/usePopupViewport';
import { EMPTY_OBJECT } from '../../common/empty';
import { createEventEmitter } from './createEventEmitter';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { REASONS } from '../../internals/reasons';
import type { InteractionType } from './usePopupTrigger';
import { useControlledDefault } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { bindPopupParts } from './popupBindings';
import { HeldRootCallContext } from './popupHandle';
import { useFloatingParentNodeId } from './tree/FloatingTree';

// The development check must stay linear when many triggers share a handle.
let devElementIdsByMap: WeakMap<PopupTriggerMap, WeakMap<Element, string>> | undefined;

function getDevElementIds(map: PopupTriggerMap) {
  devElementIdsByMap ??= new WeakMap();

  let elementIds = devElementIdsByMap.get(map);
  if (!elementIds) {
    elementIds = new WeakMap();
    devElementIdsByMap.set(map, elementIds);
  }
  return elementIds;
}

// A registration must recognize its own element even while the public map hides it.
export let registeredTrigger: (map: PopupTriggerMap, id: string | undefined) => Element | undefined;

/** Held triggers keep their place in registration order until activation. */
export class PopupTriggerMap {
  #idMap = new Map<string, Element>();

  #inactiveIds = new Set<string>();

  static {
    registeredTrigger = (map, id) => (id === undefined ? undefined : map.#idMap.get(id));
  }

  /**
   * Hides the entry with the given ID from each reader while `active` is `false`. The entry keeps
   * its place in the order of the entries. A new entry for an ID is active.
   */
  setActive(id: string, active: boolean) {
    if (active) {
      this.#inactiveIds.delete(id);
    } else if (this.#idMap.has(id)) {
      this.#inactiveIds.add(id);
    }
  }

  /**
   * Adds a trigger element with the given ID.
   *
   * The element must not be registered under another ID.
   */
  add(id: string, element: Element) {
    if (process.env.NODE_ENV !== 'production') {
      const elementIds = getDevElementIds(this);

      const existingId = elementIds.get(element);
      if (existingId !== undefined && existingId !== id) {
        throw new Error(
          'Vase UI: A trigger element cannot be registered under multiple IDs in PopupTriggerMap. The map assumes that each element has one ID, so a second ID can select the wrong trigger. Give each trigger its own element.',
        );
      }

      // A new element for an id evicts the old element. The old element must lose its claim on the
      // id. If not, a later registration of it under another id looks like a duplicate.
      const previousElement = this.#idMap.get(id);
      if (previousElement !== undefined && previousElement !== element) {
        elementIds.delete(previousElement);
      }

      elementIds.set(element, id);
    }

    this.#idMap.set(id, element);
    this.#inactiveIds.delete(id);
  }

  /**
   * Removes the trigger element with the given ID. With `element`, the entry stays unless it holds
   * that element, also when the entry is not active. Another trigger can take an ID before the
   * trigger that held it removes its entry.
   */
  delete(id: string, element?: Element) {
    const registered = this.#idMap.get(id);
    if (element !== undefined && registered !== element) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      if (registered !== undefined) {
        devElementIdsByMap?.get(this)?.delete(registered);
      }
    }

    this.#idMap.delete(id);
    this.#inactiveIds.delete(id);
  }

  /**
   * Whether the given element is registered as a trigger.
   */
  hasElement(element: Element): boolean {
    for (const registered of this.elements()) {
      if (registered === element) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether a registered trigger element matches the given predicate.
   */
  hasMatchingElement(predicate: (el: Element) => boolean): boolean {
    for (const element of this.elements()) {
      if (predicate(element)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the trigger element for the given ID, or `undefined` when there is none.
   */
  getById(id: string): Element | undefined {
    return this.#inactiveIds.has(id) ? undefined : this.#idMap.get(id);
  }

  /**
   * Returns an iterable of the registered trigger entries. Each entry is a tuple of [id, element].
   */
  *entries(): IterableIterator<[string, Element]> {
    for (const entry of this.#idMap.entries()) {
      if (!this.#inactiveIds.has(entry[0])) {
        yield entry;
      }
    }
  }

  /**
   * Returns an iterable of the registered trigger elements.
   */
  *elements(): IterableIterator<Element> {
    for (const [, element] of this.entries()) {
      yield element;
    }
  }

  /**
   * Returns the number of registered trigger elements.
   */
  get size(): number {
    return this.#idMap.size - this.#inactiveIds.size;
  }
}

/**
 * Tells the interaction composables of a popup about an accepted open change. It records the event
 * that opened the popup. Then it emits `openchange`.
 *
 * @param context The context of the store that the interaction composables read.
 * @param open Whether the popup is open before the change.
 * @param newOpen Whether the popup is open after the change.
 * @param eventDetails Details about the event that caused the change.
 */
export function dispatchOpenChange(
  context: Pick<PopupInteractionContext, 'openEvent' | 'events' | 'nested'>,
  open: boolean,
  newOpen: boolean,
  eventDetails: VaseUIChangeEventDetails<string>,
) {
  const event = eventDetails.event;

  // The open event lets the hover logic tell a hover open from a click open. A hover open that
  // waits must not replace the event of a click open. A click can replace the event of a hover
  // open.
  if (!newOpen || !open || (event != null && isClickLikeEvent(event))) {
    context.openEvent = newOpen ? event : undefined;
  }

  const details: FloatingUIOpenChangeDetails = {
    open: newOpen,
    reason: eventDetails.reason,
    nativeEvent: event,
    nested: context.nested,
    triggerElement: eventDetails.trigger,
  };

  context.events.emit('openchange', details);
}

/** An inert handle keeps its trigger map but ignores state writes. */
export class NullStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> extends ReactiveStore<State, Context, Selectors> {
  override setState(_newState: State) {}
}

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
   * Whether the open popup keeps no trigger after a triggerless request or the release of a null
   * `triggerId`. A new registration then leaves the payload with the popup.
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
   * The `id` of the popup element. The store follows each change of the attribute.
   */
  popupElementId: string | undefined;
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
    popupElementId: undefined,
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
  readonly viewportStyles: ShallowRef<ReturnType<typeof usePopupAutoResize> | null>;
  /**
   * A ref to the element of the popup.
   */
  readonly popupRef: ShallowRef<HTMLElement | null>;
  /**
   * The popup element, also while `KeepAlive` holds the part. `getPopupTransitionElement` uses it
   * when the popup, positioner and backdrop give no element.
   */
  readonly keptPopupRef: ShallowRef<HTMLElement | null>;
  /**
   * A ref to the element of the backdrop part, also while `KeepAlive` holds the part. Its animations
   * end an open change while the popup and the positioner give no element. This also lets a
   * backdrop that first mounts in a held branch end a close on its own.
   */
  readonly backdropRef: ShallowRef<HTMLElement | null>;
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
    viewportStyles: shallowRef<ReturnType<typeof usePopupAutoResize> | null>(null),
    popupRef: shallowRef<HTMLElement | null>(null),
    keptPopupRef: shallowRef<HTMLElement | null>(null),
    backdropRef: shallowRef<HTMLElement | null>(null),
    triggerElements: new PopupTriggerMap(),
    onOpenChange: undefined,
    onOpenChangeComplete: undefined,
    events: createEventEmitter(),
    nested: false,
  };
}

type S = PopupStoreState<unknown>;

const activeTriggerIdSelector = (state: S) =>
  state.triggerIdProp === undefined ? state.activeTriggerId : state.triggerIdProp;

const openSelector = (state: S) => state.openProp ?? state.open;

const activeTriggerElementSelector = (state: S) =>
  state.mounted ? state.activeTriggerElement : null;

// A trigger names only an id that an element has now. No popup element, or one with an empty `id`,
// gives no id.
const popupIdSelector = (state: S) => state.popupElementId || undefined;

function triggerOwnsOpenPopup(state: S, triggerId: string | undefined) {
  return (
    triggerId !== undefined && openSelector(state) && activeTriggerIdSelector(state) === triggerId
  );
}

export function canClaimOpenPopup(state: S) {
  return (
    openSelector(state) &&
    state.triggerIdProp === undefined &&
    state.activeTriggerId === null &&
    !state.openedWithoutTrigger
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
    triggerOwnsOpenPopup(state, triggerId) ||
    (triggerId !== undefined && state.triggerCount === 1 && canClaimOpenPopup(state))
      ? popupIdSelector(state)
      : undefined,
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
    activeTriggerElement: state.triggerIdProp === null ? null : activeTriggerElement,
    // A handle can open with its own payload. A later trigger registration must leave it in place.
    // A close request keeps the flag until the parent accepts the close.
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
 * Makes a function that follows the `id` of one element. Each call stops following the last element
 * and follows the new one. It gives the `id` that the new element has now. `onChange` runs after
 * each later change of the attribute.
 *
 * A store copies the `id` of an element of its state to a key of its state with this function. A
 * `computed` does not follow a read of the DOM. Code in the `setup` of a part or of a root calls
 * `useElementId` in place of this function.
 */
export function createElementIdObserver(
  onChange: () => void,
): (element: Element | null) => string | undefined {
  let observer: MutationObserver | undefined;
  return (element) => {
    observer?.disconnect();
    if (element === null) {
      return undefined;
    }
    observer ??= new MutationObserver(onChange);
    observer.observe(element, { attributeFilter: ['id'] });
    return element.id;
  };
}

/** Emit a request before commit. A synchronous veto stops the interaction and all state writes. */
export abstract class BasePopupStore<
  State extends PopupStoreState<unknown>,
  Context extends PopupStoreContext<ChangeEventDetails>,
  Selectors extends Record<string, (state: Readonly<State>, ...args: any[]) => any>,
  ChangeEventDetails extends PopupOpenChangeEventDetails,
> extends ReactiveStore<Readonly<State>, Context, Selectors> {
  // A new object for each open. A close uses it to know if the popup opened again since.
  #openSession = {};

  // A render can give the popup element a new `id` and write nothing to the store. The id comes
  // from a prop, an attribute or the `#render` slot.
  readonly #observePopupId = createElementIdObserver(() => {
    this.set('popupElementId', toRaw(this.state).popupElement?.id);
  });

  override setState(newState: Readonly<State>): void {
    const current = toRaw(this.state);
    // A request or an `open` prop that opens the popup starts a new open session. An open request
    // that a controlled `open` prop did not apply does not start one. A close that waits for the
    // parent then keeps its request.
    if (!openSelector(current) && openSelector(newState)) {
      this.#openSession = {};
    }
    let next = this.anchorsToActiveTrigger() ? syncAnchorState(current, newState) : newState;
    if (next.popupElement !== current.popupElement) {
      next = { ...next, popupElementId: this.#observePopupId(next.popupElement) };
    }

    // An open watcher needs the new trigger and reason. Snapshot all changed keys before the first write.
    const { open, openProp, ...fields } = next;
    super.setState({ ...fields, open, openProp } as Readonly<State>);
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
      if (closeSession === this.#openSession) {
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
      closeSession = this.#openSession;
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

/** An inert handle and an attached root give the trigger the same store interface. */
export type PopupTriggerStoreKeys = 'context' | 'select' | 'set' | 'state' | 'update';

/**
 * The part of a popup store that a trigger uses to register itself and to give its data. It is
 * narrow, so a detached trigger can use an inert store.
 */
export type PopupTriggerDataStore<State extends PopupStoreState<unknown>> = Pick<
  ReactiveStore<Readonly<State>, PopupStoreContext<never>, PopupStoreSelectors>,
  PopupTriggerStoreKeys
>;

/**
 * The props that every popup root shares.
 */
export interface PopupRootProps {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  triggerId?: string | null | undefined;
  defaultTriggerId?: string | null | undefined;
}

export interface PopupRootActions {
  /**
   * Ends the closing phase after an exit animation that code outside the library runs.
   */
  unmount(): void;
  /**
   * Closes the popup with the reason `imperative-action`.
   */
  close(): void;
}

/**
 * The state that a popup root takes from its props when it makes the store.
 */
export type PopupRootInitialState = Pick<
  PopupStoreState<unknown>,
  'open' | 'openProp' | 'activeTriggerId' | 'triggerIdProp'
>;

interface PopupRootStoreHandle<Store> {
  attachStore(store: Store): () => void;
}

/**
 * The members of a popup store that a popup root calls.
 */
type PopupRootStore = ReactiveStore<
  Readonly<PopupStoreState<unknown>>,
  PopupStoreContext<never>,
  PopupStoreSelectors
> & {
  setOpen(
    this: void,
    open: boolean,
    eventDetails: VaseUIChangeEventDetails<typeof REASONS.imperativeAction | typeof REASONS.none>,
  ): void;
  resetOnUnmount(): void;
};

export interface UsePopupRootOptions<Store extends PopupRootStore> {
  /**
   * The component name for the warning when a default prop changes.
   */
  name: string;
  /**
   * A function of the part. It emits `openChange`, and then `update:open` when
   * `details.isCanceled` is `false`.
   */
  onOpenChange: NonNullable<Store['context']['onOpenChange']>;
  /**
   * A function of the part. It emits `openChangeComplete`.
   */
  onOpenChangeComplete: (open: boolean) => void;
  /**
   * The root attaches its store to the handle after the DOM update of its mount. A root in a
   * pending `<Suspense>` branch attaches when Vue resolves the branch. The root detaches when it
   * unmounts and while `KeepAlive` holds it. A root that mounts in a branch that `KeepAlive` holds
   * detaches in its own `onMounted` hook, after the `onMounted` hooks of the parts below it.
   * While `KeepAlive` holds the root and the store is detached, the root keeps each call of the
   * handle in a lifecycle hook of a part below it, and runs the calls after its activation.
   */
  handle?: MaybeRefOrGetter<PopupRootStoreHandle<Store> | undefined>;
  /**
   * Whether the popup closes with the reason `none` when its active trigger unmounts.
   * @default false
   */
  closeOnActiveTriggerUnmount?: boolean | undefined;
  /**
   * Whether a popup that mounts already open still plays its enter transition.
   * @default false
   */
  animateInitialOpen?: boolean | undefined;
  /**
   * Whether the popup renders as closed. Its open state in the store stays as it is.
   * @default false
   */
  disabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Gives the element whose animations end an open change. The default checks the popup, the
   * positioner, the backdrop and the kept popup element, in that order.
   */
  getTransitionElement?: ((store: Store) => HTMLElement | null) | undefined;
}

type CreatePopupRootStore<Store extends PopupRootStore> = (
  initialState: PopupRootInitialState,
  defaultPopupId: string,
) => Store;

export type UseSingleAnchorPopupRootOptions<Store extends PopupRootStore> = Pick<
  UsePopupRootOptions<Store>,
  'name' | 'onOpenChange' | 'onOpenChangeComplete' | 'getTransitionElement'
>;

/**
 * Checks the popup, positioner, backdrop and kept popup, in that order. A positioner or backdrop
 * can still animate while `KeepAlive` holds the popup.
 */
export function getPopupTransitionElement(store: PopupRootStore) {
  return (
    store.context.popupRef.value ??
    store.state.positionerElement ??
    store.context.backdropRef.value ??
    store.context.keptPopupRef.value
  );
}

/** Owns the effective open state, trigger selection, handle and transitions for one root. */
export function usePopupRoot<Store extends PopupRootStore>(
  props: PopupRootProps,
  createStore: CreatePopupRootStore<Store>,
  options: UsePopupRootOptions<Store>,
) {
  const defaultTriggerId = useControlledDefault({
    controlled: () => props.triggerId,
    default: () => props.defaultTriggerId,
    name: options.name,
    state: 'triggerId',
  });
  const store = usePopupRootStore(
    props,
    { activeTriggerId: defaultTriggerId ?? null, triggerIdProp: props.triggerId },
    createStore,
    options,
  );
  watch(
    () => props.triggerId,
    (triggerId, previous) => {
      if (triggerId === undefined) {
        store.update({
          activeTriggerId: previous ?? null,
          triggerIdProp: undefined,
          openedWithoutTrigger:
            previous === null
              ? popupStoreSelectors.open(store.state)
              : store.state.openedWithoutTrigger,
        });
      } else if (triggerId === null) {
        store.update({ triggerIdProp: null, activeTriggerElement: null });
      } else {
        store.set('triggerIdProp', triggerId);
      }
    },
  );

  const open = computed(() => !toValue(options.disabled) && popupStoreSelectors.open(store.state));
  const payload = computed(() => store.state.payload as Store['state']['payload']);

  const { mounted, transitionStatus, actions } = usePopupRootTransitions(
    store,
    open,
    () => (options.getTransitionElement ?? getPopupTransitionElement)(store),
    options.animateInitialOpen,
  );

  useImplicitActiveTrigger(store, {
    closeOnActiveTriggerUnmount: options.closeOnActiveTriggerUnmount,
  });

  // The first post-flush job attaches before child mount hooks. SSR and discarded Suspense branches never attach.
  const isActive = shallowRef(false);
  let attachedHandle: PopupRootStoreHandle<Store> | undefined;
  // eslint-disable-next-line no-restricted-syntax -- The handle attaches before child mount hooks, detaches at a held mount and can attach in the activation hook.
  let detachStore: (() => void) | undefined;
  function setAttachedHandle(handle: PopupRootStoreHandle<Store> | undefined) {
    if (handle === attachedHandle) {
      return;
    }
    detachStore?.();
    attachedHandle = handle;
    detachStore = handle?.attachStore(store);
  }
  watch(() => (isActive.value ? toValue(options.handle) : undefined), setAttachedHandle, {
    flush: 'post',
  });
  isActive.value = true;
  onScopeDispose(() => {
    setAttachedHandle(undefined);
  });

  // Children can call the handle at a held mount. Detach before detached triggers register in the next post flush.
  const { isHeld } = useKeepAliveState();
  let isMounted = false;
  onMounted(() => {
    isMounted = true;
    if (isHeld.value) {
      isActive.value = false;
      setAttachedHandle(undefined);
    }
  });

  // Replay held child calls after trigger registration. Separate microtasks let later calls survive an exception.
  const heldCalls: (() => void)[] = [];
  const deferToRootAbove = inject(HeldRootCallContext, null);
  provide(HeldRootCallContext, (handle, call) => {
    if (handle !== toValue(options.handle)) {
      return deferToRootAbove?.(handle, call) ?? false;
    }
    if (isActive.value) {
      return false;
    }
    heldCalls.push(call);
    return true;
  });

  watch(
    isHeld,
    (held) => {
      isActive.value = !held;
      if (held) {
        return;
      }
      if (isMounted) {
        setAttachedHandle(toValue(options.handle));
      }
      for (const call of heldCalls.splice(0)) {
        queueMicrotask(call);
      }
    },
    { flush: 'sync' },
  );

  return {
    store,
    open,
    mounted,
    payload,
    transitionStatus,
    actions,
    triggerId: computed(() => popupStoreSelectors.activeTriggerId(store.state)),
    trigger: computed(() => popupStoreSelectors.activeTriggerElement(store.state)),
    popup: computed(() => store.state.popupElement),
    requestOpen: store.setOpen as Store['setOpen'],
    bindParts: (parts: Parameters<typeof bindPopupParts>[1]) => bindPopupParts(store, parts),
  };
}

/** Select and Combobox have one anchor and do not need a trigger registry. */
export function useSingleAnchorPopupRoot<Store extends PopupRootStore>(
  props: Pick<PopupRootProps, 'open' | 'defaultOpen'>,
  createStore: CreatePopupRootStore<Store>,
  options: UseSingleAnchorPopupRootOptions<Store>,
) {
  const store = usePopupRootStore(
    props,
    { activeTriggerId: null, triggerIdProp: undefined },
    createStore,
    options,
  );

  const open = computed(() => popupStoreSelectors.open(store.state));
  const { mounted, transitionStatus, actions } = usePopupRootTransitions(store, open, () =>
    (options.getTransitionElement ?? getPopupTransitionElement)(store),
  );

  return {
    store,
    open,
    mounted,
    transitionStatus,
    actions,
    requestOpen: store.setOpen as Store['setOpen'],
    bindParts: (parts: Parameters<typeof bindPopupParts>[1]) => bindPopupParts(store, parts),
  };
}

/**
 * Makes the store of a popup root with a generated default popup id, gives it the functions of the
 * part, and keeps `nested` current.
 */
function usePopupRootStore<Store extends PopupRootStore>(
  props: Pick<PopupRootProps, 'open' | 'defaultOpen'>,
  trigger: Pick<PopupRootInitialState, 'activeTriggerId' | 'triggerIdProp'>,
  createStore: CreatePopupRootStore<Store>,
  options: Pick<UsePopupRootOptions<Store>, 'name' | 'onOpenChange' | 'onOpenChangeComplete'>,
) {
  const defaultOpen = useControlledDefault({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: options.name,
    state: 'open',
  });
  const store = createStore(
    { ...trigger, open: defaultOpen ?? false, openProp: props.open },
    useVaseUiId().value,
  );
  store.context.onOpenChange = options.onOpenChange;
  store.context.onOpenChangeComplete = options.onOpenChangeComplete;

  const parentNodeId = useFloatingParentNodeId();
  watch(
    parentNodeId,
    (id) => {
      store.context.nested = id !== null;
    },
    { immediate: true },
  );

  // Reset the last open request on a controlled close. An open request during the exit can then
  // keep its trigger when the popup unmounts.
  watch(
    () => props.open,
    (open, previous) => {
      if (open === false) {
        store.update({ openProp: false, open: false });
      } else if (open === true) {
        store.set('openProp', true);
      } else if (previous !== undefined) {
        store.update({ openProp: undefined, open: previous });
      }
    },
    { immediate: true },
  );

  return store;
}

/**
 * Keeps the popup mounted through its exit animation, copies `mounted` and `transitionStatus` to
 * the store, and makes the actions of the part.
 */
function usePopupRootTransitions(
  store: PopupRootStore,
  open: Readonly<Ref<boolean>>,
  transitionElement: () => HTMLElement | null,
  animateInitialOpen?: boolean,
) {
  // One `true` for each open. A popup part that attaches after the completion starts no second one.
  let openCompleted = false;
  const { mounted, transitionStatus, forceUnmount } = useUnmountAfterClose({
    open,
    ref: transitionElement,
    preventUnmountOnClose: () => store.state.preventUnmountingOnClose,
    setPreventUnmountOnClose: (preventUnmountOnClose) =>
      store.set('preventUnmountingOnClose', preventUnmountOnClose),
    animateInitialOpen,
    onUnmount() {
      store.resetOnUnmount();
      openCompleted = false;
      store.context.onOpenChangeComplete?.(false);
    },
  });

  // A sync watcher writes `mounted` in the write that changes it, so a part never reads a value
  // that is one open change old. The first run gives the first state, so a root that mounts open
  // does not look like a reopen.
  watch(
    [mounted, transitionStatus],
    ([nextMounted, nextTransitionStatus]) => {
      store.update({ mounted: nextMounted, transitionStatus: nextTransitionStatus });
    },
    { flush: 'sync', immediate: true },
  );

  // The open wait follows the open state of the store, as `openChange` does, and not the `open` of
  // a disabled root. A disabled root that stays mounted thus reports no second open completion when
  // it shows again.
  const storeOpen = () => popupStoreSelectors.open(store.state);
  // `openCompleted` resets at a close, where the open wait does nothing. The result thus does not
  // depend on the order of the watchers.
  watch(storeOpen, (isOpen) => {
    if (!isOpen) {
      openCompleted = false;
    }
  });
  useOpenChangeComplete({
    enabled: storeOpen,
    open: storeOpen,
    ref: transitionElement,
    restartKey: transitionElement,
    onComplete() {
      if (storeOpen() && !openCompleted) {
        openCompleted = true;
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const actions: PopupRootActions = {
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
  };

  return { mounted: computed(() => store.state.mounted), transitionStatus, actions };
}

/**
 * Keeps the trigger registration and the state of an open popup in step. Call it in `setup` of the
 * root. It does nothing while `KeepAlive` holds the root, also at a mount in a held branch.
 *
 * - An open popup can take its only registered trigger when it allows an implicit trigger.
 * - When triggers join such a popup and none claims it, the first
 *   trigger of the trigger map that is in the document becomes the active trigger. `KeepAlive`
 *   activates the triggers in an order that depends on the tree, so a claim by each trigger
 *   would not give the result of the mount.
 * - The element of the active trigger follows its registration. An active trigger id that is not
 *   registered, but names the element of the active trigger, gets the registered id.
 * - With `closeOnActiveTriggerUnmount`, the popup closes with the reason `none` when the active
 *   trigger unregisters. The close waits one microtask, so that a trigger with the same id can
 *   register first. An active trigger id that has not matched a trigger yet is pending.
 */
export function useImplicitActiveTrigger<State extends PopupStoreState<unknown>>(
  store: PopupTriggerDataStore<State> & {
    setOpen(open: boolean, eventDetails: VaseUIChangeEventDetails<typeof REASONS.none>): void;
  },
  options: { closeOnActiveTriggerUnmount?: boolean | undefined } = {},
) {
  const { closeOnActiveTriggerUnmount = false } = options;
  // The code below uses only the keys that each popup state has.
  const target: PopupTriggerDataStore<PopupStoreState<unknown>> & {
    setOpen(open: boolean, eventDetails: VaseUIChangeEventDetails<typeof REASONS.none>): void;
  } = store;
  // Tells a trigger that unmounted from an active trigger that has not registered yet.
  let resolvedActiveTriggerId: string | null = null;
  // The trigger count of the last run while the popup was open, and `null` while it is closed. The
  // open of a popup that has many triggers is thus not a join.
  let previousTriggerCount: number | null = null;
  const { isHeld } = useKeepAliveState();

  function run() {
    const state = toRaw(target.state);
    if (!popupStoreSelectors.open(state)) {
      resolvedActiveTriggerId = null;
      previousTriggerCount = null;
      if (state.triggerCount !== 0) {
        target.set('triggerCount', 0);
      }
      // A controlled root can decline a close and stay open, and a controlled close does not reach
      // `createPopupOpenState`. The flag thus ends only here, once the popup is closed.
      if (state.openedWithoutTrigger) {
        target.set('openedWithoutTrigger', false);
      }
      return;
    }

    const triggerElements = target.context.triggerElements;
    const triggerCount = triggerElements.size;
    const hasJoined = previousTriggerCount !== null && triggerCount > previousTriggerCount;
    previousTriggerCount = triggerCount;
    const stateUpdates: Partial<
      Pick<PopupStoreState<unknown>, 'triggerCount' | 'activeTriggerId' | 'activeTriggerElement'>
    > = {};

    if (state.triggerCount !== triggerCount) {
      stateUpdates.triggerCount = triggerCount;
    }

    const currentActiveTriggerId = popupStoreSelectors.activeTriggerId(state);
    let lostActiveTriggerId: string | null = null;

    if (currentActiveTriggerId) {
      const activeTriggerElement = triggerElements.getById(currentActiveTriggerId);
      if (!activeTriggerElement) {
        for (const [triggerId, triggerElement] of triggerElements.entries()) {
          if (triggerElement === state.activeTriggerElement) {
            stateUpdates.activeTriggerId = triggerId;
            stateUpdates.activeTriggerElement = triggerElement;
            resolvedActiveTriggerId = triggerId;
            break;
          }
        }

        if (stateUpdates.activeTriggerId === undefined) {
          if (resolvedActiveTriggerId === currentActiveTriggerId) {
            lostActiveTriggerId = currentActiveTriggerId;
          } else {
            resolvedActiveTriggerId = null;
          }
        }
      } else {
        resolvedActiveTriggerId = currentActiveTriggerId;
        if (activeTriggerElement !== state.activeTriggerElement) {
          stateUpdates.activeTriggerElement = activeTriggerElement;
        }
      }
    } else {
      resolvedActiveTriggerId = null;
    }

    if (canClaimOpenPopup(state)) {
      for (const [triggerId, triggerElement] of triggerElements.entries()) {
        if (triggerCount === 1 || (hasJoined && triggerElement.isConnected)) {
          stateUpdates.activeTriggerId = triggerId;
          stateUpdates.activeTriggerElement = triggerElement;
          resolvedActiveTriggerId = triggerId;
          break;
        }
      }
    }

    if (Object.keys(stateUpdates).length > 0) {
      target.update(stateUpdates as Required<typeof stateUpdates>);
    }

    if (lostActiveTriggerId && closeOnActiveTriggerUnmount) {
      const lostId = lostActiveTriggerId;
      queueMicrotask(() => {
        const current = toRaw(target.state);
        if (
          popupStoreSelectors.open(current) &&
          popupStoreSelectors.activeTriggerId(current) === lostId &&
          !triggerElements.getById(lostId)
        ) {
          const eventDetails = createChangeEventDetails(REASONS.none);
          target.setOpen(false, eventDetails);
          // A canceled close keeps the active trigger of the popup that stays open.
          if (!eventDetails.isCanceled) {
            target.update({ activeTriggerId: null, activeTriggerElement: null });
          }
        }
      });
    }
  }

  // `KeepAlive` hides the triggers of a held root from each reader of the map, and a run then
  // would take that for an unmount. The triggers of a held root join again when it activates.
  watch(
    isHeld,
    (held) => {
      if (held) {
        previousTriggerCount = 0;
      }
    },
    { flush: 'sync' },
  );

  function runWhileActive() {
    if (!isHeld.value) {
      run();
    }
  }

  // A trigger registers after the DOM update, so the run waits for that update.
  onMounted(runWhileActive);
  watch(
    [
      () => popupStoreSelectors.open(target.state),
      () => popupStoreSelectors.triggerCount(target.state),
      () => popupStoreSelectors.activeTriggerId(target.state),
      () => popupStoreSelectors.activeTriggerElement(target.state),
      isHeld,
    ],
    runWhileActive,
    { flush: 'post' },
  );
}

/**
 * Clears the open method of a popup that keeps one, when the popup closes and when the root
 * unmounts. Call it in `setup` of the root.
 *
 * @param store The store of the popup.
 * @param open Whether the popup is open, as `usePopupRoot` returns it.
 */
export function usePopupRootSync<
  State extends PopupStoreState<unknown> & { openMethod: InteractionType | null },
>(
  store: ReactiveStore<Readonly<State>, PopupStoreContext<never>, PopupStoreSelectors>,
  open: MaybeRefOrGetter<boolean>,
) {
  function clearOpenMethod() {
    if (toRaw(store.state).openMethod !== null) {
      store.set('openMethod', null);
    }
  }

  watch(
    () => toValue(open),
    (isOpen) => {
      if (!isOpen) {
        clearOpenMethod();
      }
    },
  );
  onScopeDispose(clearOpenMethod);
}
