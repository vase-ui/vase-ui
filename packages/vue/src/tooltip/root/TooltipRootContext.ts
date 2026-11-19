import { toRaw, inject, onMounted, onScopeDispose, provide, shallowRef, toValue, watch } from 'vue';
import { NOOP } from '../../common/empty';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  dispatchOpenChange,
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
  usePopupRoot,
} from '../../utils/popups/usePopupRoot';
import type {
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
} from './TooltipRoot.vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';
import { Timeout, useTimeout } from '../../common/useTimeout';
import { getDelay } from '../../utils/popups/interactions/usePopupHover';
import type { Delay } from '../../utils/popups/types';

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

export const TooltipPortalContext: InjectionKey<ComputedRef<boolean>> = Symbol();

export function useTooltipPortalContext(): ComputedRef<boolean> {
  const value = inject(TooltipPortalContext, undefined);
  if (value === undefined) {
    throw new Error(
      'Vase UI: <Tooltip.Positioner> must be inside <Tooltip.Portal>. Without a portal the positioner does not know if the popup stays mounted while it is closed. Put the positioner inside <Tooltip.Portal>.',
    );
  }
  return value;
}

export type TooltipPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'createArrowRef' | 'arrowUncentered' | 'arrowStyles'
>;

export const TooltipPositionerContext: InjectionKey<TooltipPositionerContext> = Symbol();

export function useTooltipPositionerContext(): TooltipPositionerContext {
  const context = inject(TooltipPositionerContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A popup or an arrow of Tooltip must be inside <Tooltip.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Tooltip.Positioner>.',
    );
  }
  return context;
}

/**
 * Holds the `delay` of the provider. The delay group holds `closeDelay`.
 */
export type TooltipProviderContext = ComputedRef<number | undefined>;

export const TooltipProviderContext: InjectionKey<TooltipProviderContext> = Symbol();

export function useTooltipProviderContext(): TooltipProviderContext | undefined {
  return inject(TooltipProviderContext, undefined);
}

interface DelayGroupMember {
  closeForSibling: () => void;
  setIsInstantPhase: (value: boolean) => void;
}

// Members read the delay at the next interaction. A change of delay needs no render.
interface DelayGroup {
  hasProvider: boolean;
  timeoutMs: () => number;
  delay: Delay;
  initialDelay: Delay;
  timeout: Timeout;
  currentId: string | null | undefined;
  currentContext: DelayGroupMember | null;
}

// Only mounted triggers can join the default group. Server requests share this object.
const DEFAULT_DELAY_GROUP: DelayGroup = {
  hasProvider: false,
  timeoutMs: () => 0,
  delay: 0,
  initialDelay: 0,
  timeout: Timeout.create(),
  currentId: null,
  currentContext: null,
};

const FloatingDelayGroupContext: InjectionKey<DelayGroup> = Symbol();

export interface FloatingDelayGroupOptions {
  /**
   * The delay to use for the group when it is not in the instant phase.
   */
  delay: MaybeRefOrGetter<Delay>;
  /**
   * How long the group stays active after a popup closes. Use it to make the group last longer
   * than the close delay, for example when there is no close delay.
   * @default 0
   */
  timeoutMs?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Provides a group of floating elements that share a `delay`. Once one of them opens, the others
 * open instantly until `timeoutMs` passes after it closes. Call it in `setup`. The members read
 * the group when they need it, so a change of the delay renders no member.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function provideFloatingDelayGroup(options: FloatingDelayGroupOptions): void {
  const delay = toValue(options.delay);
  const group: DelayGroup = {
    hasProvider: true,
    timeoutMs: () => toValue(options.timeoutMs) ?? 0,
    delay,
    initialDelay: delay,
    timeout: useTimeout(),
    currentId: null,
    currentContext: null,
  };

  watch(
    () => toValue(options.delay),
    (nextDelay) => {
      group.initialDelay = nextDelay;
      if (!group.currentId) {
        group.delay = nextDelay;
        return;
      }
      group.delay = { open: getDelay(group.delay, 'open'), close: getDelay(nextDelay, 'close') };
    },
  );

  provide(FloatingDelayGroupContext, group);
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger that calls the composable opened the popup.
   */
  open: MaybeRefOrGetter<boolean>;
  popupId: () => string | undefined;
  popupOpen: () => boolean;
  closeForSibling: () => void;
}

interface UseDelayGroupReturn {
  /**
   * The id of the popup that keeps the delay group active.
   */
  activeId: () => string | null | undefined;
  /**
   * The delay of the group now. While a popup keeps the group active, its open delay is 0.
   */
  delay: () => Delay;
  /**
   * Whether animations should be removed. It is `true` for a popup that opens while another popup
   * of the group is active, and for that other popup.
   */
  isInstantPhase: Readonly<Ref<boolean>>;
  /**
   * Whether a part above the caller called `provideFloatingDelayGroup`.
   */
  hasProvider: boolean;
}

/** A detached member follows its current popup when the group closes a sibling. */
export function useDelayGroup(options: UseDelayGroupOptions): UseDelayGroupReturn {
  const group = inject(FloatingDelayGroupContext, DEFAULT_DELAY_GROUP);

  const isInstantPhase = shallowRef(false);
  const member: DelayGroupMember = {
    closeForSibling: options.closeForSibling,
    setIsInstantPhase: (value) => {
      isInstantPhase.value = value;
    },
  };

  const isOpen = () => toValue(options.open);
  const getPopupId = options.popupId;

  function unset() {
    group.currentContext?.setIsInstantPhase(false);
    group.currentId = null;
    group.currentContext = null;
    group.delay = group.initialDelay;
    group.timeout.clear();
  }

  function onClose(id: string | undefined) {
    if (!group.currentId || group.currentId !== id) {
      return;
    }

    isInstantPhase.value = false;
    const timeoutMs = group.timeoutMs();
    if (!timeoutMs) {
      unset();
      return;
    }

    group.timeout.start(timeoutMs, () => {
      // The popup can be open for another trigger, or another popup can hold the group.
      if (options.popupOpen() || (group.currentId && group.currentId !== id)) {
        return;
      }
      unset();
    });
  }

  function onOpen(id: string | undefined) {
    const previousContext = group.currentContext;
    const previousId = group.currentId;

    // A popup opens, so the timer that ends the group must not run.
    group.timeout.clear();
    group.currentContext = member;
    group.currentId = id;
    group.delay = { open: 0, close: getDelay(group.initialDelay, 'close') };

    if (previousId !== null && previousId !== id) {
      isInstantPhase.value = true;
      previousContext?.setIsInstantPhase(true);
      previousContext?.closeForSibling();
    } else {
      isInstantPhase.value = false;
      previousContext?.setIsInstantPhase(false);
    }
  }

  // The values of the last run. Vue runs the cleanup of a part in the render of its parent. The
  // cleanup thus reads no reactive state.
  let lastId: string | undefined;
  let lastOpen = false;

  // A popup that unmounts, or that gets a new id, leaves the context of the group. A closed
  // popup does not end the group: the timer of its close does.
  function release() {
    if (group.currentId !== lastId) {
      return;
    }

    group.currentContext = null;
    if (!lastOpen) {
      return;
    }
    group.currentId = null;
    group.delay = group.initialDelay;
    group.timeout.clear();
  }

  function update() {
    const open = isOpen();
    const id = getPopupId();
    if (id !== lastId) {
      release();
    }
    lastId = id;
    lastOpen = open;

    if (open) {
      onOpen(id);
    } else {
      onClose(id);
    }
  }

  // A popup that starts open joins after mount so server renders leave the group alone.
  onMounted(update);
  // The default flush runs the watcher before the render of the caller. A popup that the caller
  // renders is then inserted with its instant phase. With `flush: 'post'`, the phase comes after
  // the insert.
  watch([isOpen, getPopupId], update);
  // Restart the close timer without ending the instant phase of an open popup.
  watch(group.timeoutMs, () => {
    if (!isOpen()) {
      onClose(getPopupId());
    }
  });
  onScopeDispose(release);

  return {
    activeId: () => group.currentId,
    delay: () => group.delay,
    isInstantPhase,
    hasProvider: group.hasProvider,
  };
}

export type TooltipRootContext<Payload = unknown> = ReturnType<
  typeof usePopupRoot<TooltipStore<Payload>>
>;

export const TooltipRootContext: InjectionKey<TooltipRootContext<any>> = Symbol();

export function useTooltipRootContext(optional?: false): TooltipRootContext;
export function useTooltipRootContext(optional: true): TooltipRootContext | undefined;
export function useTooltipRootContext(optional?: boolean) {
  const context = inject(TooltipRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Tooltip must be inside <Tooltip.Root>. Without a root the part has no tooltip state. Put the part inside <Tooltip.Root>.',
    );
  }
  return context;
}

export const OPEN_DELAY = 600;
