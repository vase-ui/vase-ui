import {
  computed,
  inject,
  onMounted,
  onScopeDispose,
  provide,
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
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { HeldRootCallContext } from './popupHandle';
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
   * Gives the element whose animations end an open change. The default is the popup element, else
   * the positioner element, else the backdrop element.
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
 * Gives the element whose animations end an open change: the popup element, else the positioner
 * element, else the backdrop element.
 */
export function getPopupTransitionElement(store: PopupRootStore) {
  return (
    store.context.popupRef.value ?? store.state.positionerElement ?? store.context.backdropRef.value
  );
}

/**
 * Does what every popup root does for its popup. Call it in `setup` of the root.
 *
 * @param props The props that every popup root shares. They give the first state of the store, and
 * the composable then follows `open` and `triggerId`.
 * @param createStore Makes the store one time. The store belongs to the root, and the handle
 * attaches to it.
 * A prop that the store also holds, such as `disabled`, goes into the first state here, and one
 * `watch` writes each later change. A server runs no `watch`, so the server HTML has the first
 * state.
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
    () => (options.getTransitionElement ?? getPopupTransitionElement)(store),
    options.animateInitialOpen,
  );

  useImplicitActiveTrigger(store, {
    closeOnActiveTriggerUnmount: options.closeOnActiveTriggerUnmount,
  });

  // A `watch` with `immediate` runs in `setup`, also on a server, and all requests can share a
  // handle. This `watch` has no `immediate`. The write after it gives it a first run in the post
  // flush of the mount. That run comes after the DOM update and before the `onMounted` hook of each
  // part below the root, so such a hook can call the handle. A write in `onMounted` of the root
  // would come after those hooks. Vue holds that run while the root is in a pending `<Suspense>`
  // branch, and a branch that Vue drops never runs it.
  const isActive = shallowRef(false);
  let attachedHandle: PopupRootStoreHandle<Store> | undefined;
  // eslint-disable-next-line no-restricted-syntax -- The handle attaches in the post flush and can detach in the mount or hold hook.
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

  // A root that mounts in a branch that `KeepAlive` holds also attaches in that run, so an
  // `onMounted` hook of a part below it reaches its store. The `onMounted` hook of the root comes
  // after those hooks, and it detaches the store directly. A `watch` job that a post flush queues
  // runs in a later pass of the flush, after the watchers of a detached trigger that follow the
  // handle. The trigger would then register in the store of the held root.
  // When `KeepAlive` shows the branch in the flush of the mount, the activation can come after that
  // detach. The `watch` of the handle then gets the same handle as in its last run and does not
  // call `setAttachedHandle`, so the `watch` of `isHeld` calls it. An activation can also come
  // before the mount, as in a pending `<Suspense>` branch below a `KeepAlive`. Only the `watch` of
  // the handle attaches such a root.
  const { isHeld } = useKeepAliveState();
  let isMounted = false;
  onMounted(() => {
    isMounted = true;
    if (isHeld.value) {
      isActive.value = false;
      setAttachedHandle(undefined);
    }
  });

  // Vue runs the hooks of a part that mounts below the root while `KeepAlive` holds the root and
  // the store is detached. The root keeps each call of its handle in those hooks and runs it
  // after its activation, as Base UI runs the effects of a part in a hidden `Activity` tree when
  // the tree shows. The trigger map skips each trigger of the root until a later pass of the
  // activation flush, so each call waits for a microtask of its own. A call that throws then does
  // not stop the calls after it.
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
  const { mounted, transitionStatus, actions } = usePopupRootTransitions(store, open, () =>
    (options.getTransitionElement ?? getPopupTransitionElement)(store),
  );

  return { store, open, mounted, transitionStatus, actions };
}

/**
 * Makes the store of a popup root with a generated default popup id, gives it the functions of the
 * part, and keeps `nested` current.
 */
function usePopupRootStore<Store extends PopupRootStore>(
  initialState: PopupRootInitialState,
  createStore: CreatePopupRootStore<Store>,
  options: Pick<UsePopupRootOptions<Store>, 'onOpenChange' | 'onOpenChangeComplete'>,
) {
  const store = createStore(initialState, useVaseUiId().value);
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
  transitionElement: () => HTMLElement | null,
  animateInitialOpen?: boolean,
) {
  // One `true` for each open. A popup part that attaches after the completion starts no second one.
  let openCompleted = false;
  const { mounted, transitionStatus, forceUnmount } = useUnmountAfterClose({
    open,
    ref: transitionElement,
    preventUnmountOnClose: () => store.select('preventUnmountingOnClose'),
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
  const storeOpen = () => store.select('open');
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

  return { mounted, transitionStatus, actions };
}

/**
 * Keeps the trigger registration and the state of an open popup in step. Call it in `setup` of the
 * root. It does nothing while `KeepAlive` holds the root, also at a mount in a held branch.
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
      () => target.select('open'),
      () => target.select('triggerCount'),
      () => target.select('activeTriggerId'),
      () => target.select('activeTriggerElement'),
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
