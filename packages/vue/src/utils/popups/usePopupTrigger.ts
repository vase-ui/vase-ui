import { computed, onMounted, shallowRef, toRaw, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, ShallowRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { readTriggerStore } from './popupHandle';
import type { PopupHandleStoreProvider } from './popupHandle';
import { canClaimOpenPopup, popupStoreSelectors } from './store';
import type { PopupStoreState, PopupTriggerDataStore } from './store';

export function usePopupHandleStore<HandleStore>(
  handle: MaybeRefOrGetter<PopupHandleStoreProvider<HandleStore> | undefined>,
): ComputedRef<HandleStore | undefined> {
  const isHydrating = useIsHydrating();

  return computed(() => {
    const current = toValue(handle);
    if (current === undefined) {
      return undefined;
    }
    return isHydrating.value ? current.serverStore : readTriggerStore(current);
  });
}

export function useTriggerOwner<Store>(
  root: Store | undefined,
  handle: () => PopupHandleStoreProvider<Store> | undefined,
  family: string,
) {
  const attached = usePopupHandleStore(handle);
  if (root === undefined && handle() === undefined) {
    throw new Error(
      `Vase UI: <${family}.Trigger> must be inside <${family}.Root>, or it must have a \`handle\`. Without a root the trigger has no ${family === 'PreviewCard' ? 'preview card' : family.toLowerCase()} to open. Put the trigger inside <${family}.Root>, or pass a \`handle\`.`,
    );
  }
  // A trigger needs a root or a handle at mount.
  return computed(() => attached.value ?? (root as Store));
}

function syncTriggerCount(store: PopupTriggerDataStore<PopupStoreState<unknown>>) {
  // The cleanup of a registration runs while Vue unmounts a part, in the render of its parent. A
  // read of the reactive state there would make that render depend on the state.
  const state = toRaw(store.state);
  const triggerCount = store.context.triggerElements.size;
  if (popupStoreSelectors.open(state) && state.triggerCount !== triggerCount) {
    store.set('triggerCount', triggerCount);
  }
}

/**
 * Registers the trigger element in the trigger map of the store. Call it in `setup`.
 *
 * Give `registerTrigger` to the `ref` of the element. A `watch` adds the element to the map after
 * the DOM update. It removes the element from the map where it added it when the element, the id
 * or the store changes, and when the part unmounts. A server render registers no trigger.
 *
 * `KeepAlive` leaves the entry in its place and hides it from each reader while it holds the part.
 * A trigger that mounts in a held branch adds a hidden entry. The activation only shows the entry,
 * because `KeepAlive` runs the `onActivated` hooks of a branch from the last part to the first part.
 * A new entry in that hook would reverse the order.
 *
 * The count of triggers in the state of the store changes only while the popup is open.
 *
 * @param id The id of the trigger. With no id, the trigger does not register.
 * @param store The store of the popup. It can change, for example when a root attaches to a handle.
 * @param onRegister Called after each registration while `KeepAlive` does not hold the part, and
 * after `KeepAlive` activates the part. Use it to give the data of the trigger to the store.
 * `activated` is `true` when `KeepAlive` activated the part.
 */
export function useTriggerRegistration<State extends PopupStoreState<unknown>>(
  id: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<PopupTriggerDataStore<State>>,
  onRegister?: (
    element: Element,
    store: PopupTriggerDataStore<State>,
    id: string,
    activated: boolean,
  ) => void,
) {
  const element = shallowRef<Element | null>(null);
  const { isHeld } = useKeepAliveState();

  let registration:
    { store: PopupTriggerDataStore<State>; id: string; element: Element } | undefined;

  watch(
    [() => toValue(store), () => toValue(id), element] as const,
    ([currentStore, currentId, currentElement], _previous, onCleanup) => {
      if (currentElement === null || currentId === undefined) {
        return;
      }

      const triggerElements = currentStore.context.triggerElements;
      triggerElements.add(currentId, currentElement);
      registration = { store: currentStore, id: currentId, element: currentElement };
      onCleanup(() => {
        registration = undefined;
        // Another trigger can take the id before this cleanup runs. That entry stays.
        triggerElements.delete(currentId, currentElement);
        syncTriggerCount(currentStore);
      });

      triggerElements.setActive(currentId, !isHeld.value);
      syncTriggerCount(currentStore);
      if (!isHeld.value) {
        onRegister?.(currentElement, currentStore, currentId, false);
      }
    },
    { flush: 'post' },
  );

  watch(
    isHeld,
    (held) => {
      if (registration === undefined) {
        return;
      }

      registration.store.context.triggerElements.setActive(registration.id, !held);
      syncTriggerCount(registration.store);
      if (!held) {
        onRegister?.(registration.element, registration.store, registration.id, true);
      }
    },
    { flush: 'post' },
  );

  return {
    element: element as Readonly<ShallowRef<Element | null>>,
    registerTrigger: (next: Element | null) => {
      element.value = next;
    },
  };
}

/**
 * Registers the trigger element, and gives the data of the trigger to the store. Call it in
 * `setup`, and give `registerTrigger` to the `ref` of the element.
 *
 * The active trigger gives its element, and its `stateUpdates` while the popup is open. Another
 * trigger can claim an open popup that allows an implicit trigger.
 * An activation by `KeepAlive` claims nothing, because it runs the hooks of the triggers in an
 * order that depends on the tree. The root then picks the trigger in `useImplicitActiveTrigger`.
 * While the trigger owns the mounted popup, each change of `stateUpdates` goes to the store.
 *
 * @param triggerId The id of the trigger.
 * @param store The store of the popup.
 * @param stateUpdates A getter for the state that the trigger gives to the store, such as the
 * payload.
 */
export function usePopupTrigger<
  State extends PopupStoreState<unknown>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
>(
  triggerId: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<PopupTriggerDataStore<State>>,
  stateUpdates: () => Pick<State, Key>,
) {
  const state = () => toValue(store).state;
  const id = () => toValue(triggerId);
  const isMountedByThisTrigger = computed(() =>
    popupStoreSelectors.isMountedByTrigger(state(), id()),
  );

  const { element, registerTrigger } = useTriggerRegistration(
    triggerId,
    store,
    (registered, currentStore, id, activated) => {
      const state = toRaw(currentStore.state);
      const open = popupStoreSelectors.open(state);
      const activeTriggerId = popupStoreSelectors.activeTriggerId(state);

      if (activeTriggerId === id) {
        currentStore.update({
          activeTriggerElement: registered,
          ...(open ? stateUpdates() : null),
        } as Pick<Readonly<State>, Key | 'activeTriggerElement'>);
        return;
      }

      if (!activated && canClaimOpenPopup(state)) {
        // A detached trigger can mount while the popup is open and has no active trigger. The
        // first trigger that registers then claims the popup. A popup that opened with no trigger
        // keeps its own state, such as the payload that the caller gave.
        currentStore.update({
          activeTriggerId: id,
          activeTriggerElement: registered,
          ...stateUpdates(),
        } as Pick<Readonly<State>, Key | 'activeTriggerId' | 'activeTriggerElement'>);
      }
    },
  );

  function forward() {
    if (isMountedByThisTrigger.value) {
      toValue(store).update({
        activeTriggerElement: element.value,
        ...stateUpdates(),
      } as Pick<Readonly<State>, Key | 'activeTriggerElement'>);
    }
  }

  onMounted(forward);
  watch(
    [isMountedByThisTrigger, () => toValue(store), () => Object.values(stateUpdates())] as const,
    forward,
  );

  return {
    element,
    registerTrigger,
    isMountedByThisTrigger,
    isTriggerActive: computed(() => popupStoreSelectors.isTriggerActive(state(), id())),
    isOpenedByThisTrigger: computed(() => popupStoreSelectors.isOpenedByTrigger(state(), id())),
    popupId: computed(() => popupStoreSelectors.triggerPopupId(state(), id())),
  };
}
