import {
  computed,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import type { ReactiveStore } from './ReactiveStore';
import { popupStoreSelectors } from './store';
import type {
  PopupStoreContext,
  PopupStoreSelectors,
  PopupStoreState,
  PopupTriggerDataStore,
} from './store';
import { useFloatingParentNodeId } from './tree/FloatingTree';

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
    open: boolean,
    eventDetails: VaseUIChangeEventDetails<typeof REASONS.imperativeAction | typeof REASONS.none>,
  ): void;
  resetOnUnmount(): void;
};

export interface UsePopupRootOptions<Store extends PopupRootStore> {
  /**
   * The name of the component, for the warning about a change between controlled and uncontrolled.
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
   * The root attaches its store to the handle when it mounts. It detaches when it unmounts and
   * while `KeepAlive` holds it.
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
}

type CreatePopupRootStore<Store extends PopupRootStore> = (
  initialState: PopupRootInitialState,
  defaultPopupId: string | undefined,
) => Store;

export interface UseSingleAnchorPopupRootOptions<Store extends PopupRootStore> extends Pick<
  UsePopupRootOptions<Store>,
  'name' | 'onOpenChange' | 'onOpenChangeComplete'
> {
  /**
   * The element whose animations end the close, as a ref. The default is `store.context.popupRef`.
   * A root inside another popup, such as a dialog, gives the element of that popup. The close then
   * waits for the animations of that popup.
   */
  popupRef?: Readonly<Ref<HTMLElement | null>> | undefined;
}

/**
 * Does what every popup root does for its popup. Call it in `setup` of the root.
 *
 * @param props The props that every popup root shares. They give the first state of the store, and
 * the composable then follows `open` and `triggerId`.
 * @param createStore Makes the store one time. The store belongs to the root, and the handle
 * attaches to it.
 * @param options What differs between the popup roots.
 * @returns The store, the state that the root renders, and the actions that the part exposes.
 */
export function usePopupRoot<Store extends PopupRootStore>(
  props: PopupRootProps,
  createStore: CreatePopupRootStore<Store>,
  options: UsePopupRootOptions<Store>,
) {
  const store = usePopupRootStore(
    {
      open: props.defaultOpen ?? false,
      openProp: props.open,
      activeTriggerId: props.defaultTriggerId ?? null,
      triggerIdProp: props.triggerId,
    },
    createStore,
    options,
  );
  usePopupRootOpenState(store, props, options.name);

  // This call gives the same two warnings for `triggerId`.
  useControlled({
    controlled: () => props.triggerId,
    default: () => props.defaultTriggerId,
    name: options.name,
    state: 'triggerId',
  });
  watch(
    () => props.triggerId,
    (triggerId) => {
      if (triggerId !== undefined) {
        store.set('triggerIdProp', triggerId);
      }
    },
  );

  const open = computed(() => !toValue(options.disabled) && store.select('open'));
  const payload = computed(() => store.select('payload') as Store['state']['payload']);

  const { mounted, transitionStatus, actions } = usePopupRootTransitions(
    store,
    open,
    store.context.popupRef,
    options.animateInitialOpen,
  );

  useImplicitActiveTrigger(store, {
    closeOnActiveTriggerUnmount: options.closeOnActiveTriggerUnmount,
  });

  // A server does not call `onBeforeMount`, so a server render never writes to a handle that all
  // requests share.
  let detach: (() => void) | undefined;
  let isDeactivated = false;
  function attach() {
    detach?.();
    detach = toValue(options.handle)?.attachStore(store);
  }
  onBeforeMount(attach);
  watch(
    () => toValue(options.handle),
    () => {
      if (!isDeactivated) {
        attach();
      }
    },
  );
  onDeactivated(() => {
    isDeactivated = true;
    detach?.();
    detach = undefined;
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (isDeactivated) {
      isDeactivated = false;
      attach();
    }
  });
  onScopeDispose(() => detach?.());

  return { store, open, mounted, payload, transitionStatus, actions };
}

/**
 * Does what the root of a popup with one anchor does for its popup, such as Select and Combobox.
 * Such a root has no handle, no payload, no trigger id and no registered trigger. Call it in
 * `setup` of the root.
 *
 * @param props The `open` and `defaultOpen` props. They give the first state of the store, and the
 * composable then follows `open`.
 * @param createStore Makes the store one time. The store belongs to the root.
 * @param options What differs between the popup roots.
 * @returns The store, the state that the root renders, and the actions that the part exposes.
 */
export function useSingleAnchorPopupRoot<Store extends PopupRootStore>(
  props: Pick<PopupRootProps, 'open' | 'defaultOpen'>,
  createStore: CreatePopupRootStore<Store>,
  options: UseSingleAnchorPopupRootOptions<Store>,
) {
  const store = usePopupRootStore(
    {
      open: props.defaultOpen ?? false,
      openProp: props.open,
      activeTriggerId: null,
      triggerIdProp: undefined,
    },
    createStore,
    options,
  );
  usePopupRootOpenState(store, props, options.name);

  const open = computed(() => store.select('open'));
  const { mounted, transitionStatus, actions } = usePopupRootTransitions(
    store,
    open,
    options.popupRef ?? store.context.popupRef,
  );

  return { store, open, mounted, transitionStatus, actions };
}

/**
 * Makes the store of a popup root, gives it the functions of the part, and keeps `nested` current.
 */
function usePopupRootStore<Store extends PopupRootStore>(
  initialState: PopupRootInitialState,
  createStore: CreatePopupRootStore<Store>,
  options: Pick<UsePopupRootOptions<Store>, 'onOpenChange' | 'onOpenChangeComplete'>,
) {
  const defaultPopupId = useVaseUiId();
  const store = createStore(initialState, defaultPopupId.value);
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

  return store;
}

/**
 * Follows the `open` prop of a popup root.
 */
function usePopupRootOpenState(
  store: PopupRootStore,
  props: Pick<PopupRootProps, 'open' | 'defaultOpen'>,
  name: string,
) {
  // The store holds the state. This call only gives two warnings: a change between controlled and
  // uncontrolled, and a change of the default of an uncontrolled root.
  useControlled({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name,
    state: 'open',
  });

  // A controlled root holds its last request in `state.open`, and a close through the prop does
  // not reset it. After the reset, a `true` at the unmount is a request that came later.
  watch(
    () => props.open,
    (open) => {
      if (open === false) {
        store.update({ openProp: false, open: false });
      } else if (open !== undefined) {
        store.set('openProp', open);
      }
    },
    { immediate: true },
  );
}

/**
 * Keeps the popup mounted through its exit animation, copies `mounted` and `transitionStatus` to
 * the store, and makes the actions of the part.
 */
function usePopupRootTransitions(
  store: PopupRootStore,
  open: Readonly<Ref<boolean>>,
  popupRef: Readonly<Ref<HTMLElement | null>>,
  animateInitialOpen?: boolean | undefined,
) {
  const { mounted, transitionStatus, forceUnmount } = useUnmountAfterClose({
    open,
    ref: popupRef,
    preventUnmountOnClose: () => store.select('preventUnmountingOnClose'),
    setPreventUnmountOnClose: (preventUnmountOnClose) =>
      store.set('preventUnmountingOnClose', preventUnmountOnClose),
    animateInitialOpen,
    onUnmount() {
      store.resetOnUnmount();
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

  const actions: PopupRootActions = {
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
  };

  return { mounted, transitionStatus, actions };
}

/**
 * Keeps the trigger registration and the state of an open popup in step. Call it in `setup` of the
 * root. It does nothing while `KeepAlive` holds the root.
 *
 * - A popup with no active trigger takes the only registered trigger, unless the open request
 *   named no trigger.
 * - When triggers join an open popup that has no active trigger and none claims it, the first
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
  const deactivated = shallowRef(false);

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

    if (!lostActiveTriggerId && !currentActiveTriggerId && !state.openedWithoutTrigger) {
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

  // `KeepAlive` hides the triggers of a deactivated root from each reader of the map, and a run
  // then would take that for an unmount. The triggers of a deactivated root join again when it
  // activates.
  onDeactivated(() => {
    deactivated.value = true;
    previousTriggerCount = 0;
  });
  onActivated(() => {
    deactivated.value = false;
  });

  function runWhileActive() {
    if (!deactivated.value) {
      run();
    }
  }

  // A trigger registers after the DOM update, so the run waits for that update.
  onMounted(runWhileActive);
  watch(
    [
      () => target.select('open'),
      () => target.select('triggerCount'),
      () => target.select('activeTriggerId'),
      () => target.select('activeTriggerElement'),
      deactivated,
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
      store.set('openMethod', null as State['openMethod']);
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
