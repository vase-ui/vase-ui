import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue';
import type { HTMLAttributes, MaybeRefOrGetter, Ref, ShallowRef } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { InteractionType } from '../../common/useEnhancedClickHandler';
import type { HTMLProps } from '../../internals/types';
import { FOCUSABLE_ATTRIBUTE } from './constants';
import { popupStoreSelectors } from './store';
import type { PopupStoreState, PopupTriggerDataStore } from './store';

export const FOCUSABLE_POPUP_PROPS = {
  tabindex: -1,
  [FOCUSABLE_ATTRIBUTE]: '',
} satisfies HTMLAttributes & Record<typeof FOCUSABLE_ATTRIBUTE, string>;

/**
 * Gives the default `initialFocus` function of a popup. After a touch, it focuses the popup itself.
 * Android then does not open the virtual keyboard. iOS does not need this step. After any other
 * input, it uses the default focus.
 */
export function createDefaultInitialFocus(popupRef: Readonly<Ref<HTMLElement | null>>) {
  return (interactionType: InteractionType) =>
    interactionType === 'touch' ? popupRef.value : true;
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
 * `KeepAlive` leaves the entry in its place and hides it from each reader while the part is
 * deactivated. The two hooks only set a flag, because `KeepAlive` runs the `onActivated` hooks of
 * a branch from the last part to the first part. A new entry in that hook would reverse the order.
 *
 * The count of triggers in the state of the store changes only while the popup is open.
 *
 * @param id The id of the trigger. With no id, the trigger does not register.
 * @param store The store of the popup. It can change, for example when a root attaches to a handle.
 * @param onRegister Called after each registration and after `KeepAlive` activates the part. Use it
 * to give the data of the trigger to the store.
 */
export function useTriggerRegistration<State extends PopupStoreState<unknown>>(
  id: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<PopupTriggerDataStore<State>>,
  onRegister?: (element: Element, store: PopupTriggerDataStore<State>, id: string) => void,
) {
  const element = shallowRef<Element | null>(null);
  const deactivated = shallowRef(false);
  onDeactivated(() => {
    deactivated.value = true;
  });
  onActivated(() => {
    deactivated.value = false;
  });

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

      triggerElements.setActive(currentId, !deactivated.value);
      syncTriggerCount(currentStore);
      if (!deactivated.value) {
        onRegister?.(currentElement, currentStore, currentId);
      }
    },
    { flush: 'post' },
  );

  watch(
    deactivated,
    (isDeactivated) => {
      if (registration === undefined) {
        return;
      }

      registration.store.context.triggerElements.setActive(registration.id, !isDeactivated);
      syncTriggerCount(registration.store);
      if (!isDeactivated) {
        onRegister?.(registration.element, registration.store, registration.id);
      }
    },
    { flush: 'post' },
  );

  return {
    element: element as Readonly<ShallowRef<Element | null>>,
    registerTrigger(next: Element | null) {
      element.value = next;
    },
  };
}

/**
 * Registers the trigger element, and gives the data of the trigger to the store. Call it in
 * `setup`, and give `registerTrigger` to the `ref` of the element.
 *
 * The active trigger gives its element, and its `stateUpdates` while the popup is open. Another
 * trigger claims an open popup that has no active trigger, unless the popup opened with no trigger.
 * While the trigger owns the mounted popup, each change of `stateUpdates` goes to the store.
 *
 * @param triggerId The id of the trigger.
 * @param store The store of the popup.
 * @param stateUpdates A getter for the state that the trigger gives to the store, such as the
 * payload.
 */
export function useTriggerDataForwarding<
  State extends PopupStoreState<unknown>,
  const Key extends keyof Omit<State, 'activeTriggerId' | 'activeTriggerElement'>,
>(
  triggerId: MaybeRefOrGetter<string | undefined>,
  store: MaybeRefOrGetter<PopupTriggerDataStore<State>>,
  stateUpdates: () => Pick<State, Key>,
) {
  const isMountedByThisTrigger = computed(() =>
    toValue(store).select('isMountedByTrigger', toValue(triggerId)),
  );

  const { element, registerTrigger } = useTriggerRegistration(
    triggerId,
    store,
    (registered, currentStore, id) => {
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

      if (activeTriggerId == null && open && !state.openedWithoutTrigger) {
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

  return { registerTrigger, isMountedByThisTrigger };
}

type PopupInteractionPropKey = 'activeTriggerProps' | 'inactiveTriggerProps' | 'popupProps';

/**
 * Gives the interaction props of the popup to the store. Call it in the `setup` of the root.
 *
 * The call writes the props at once, so a part below the root gets them in its first render. It
 * writes them again when a source of `statePart` changes, and it clears them when the root
 * unmounts.
 *
 * @param store The store of the popup.
 * @param statePart A getter for the props, and for each other key of the state that the root gives.
 */
export function usePopupInteractionProps<
  State extends PopupStoreState<unknown>,
  const Key extends keyof State,
>(
  store: PopupTriggerDataStore<State>,
  statePart: () => Pick<State, Key | PopupInteractionPropKey>,
) {
  store.update(statePart());
  watch(statePart, (values) => {
    store.update(values);
  });

  onScopeDispose(() => {
    store.update({
      activeTriggerProps: EMPTY_OBJECT as HTMLProps,
      inactiveTriggerProps: EMPTY_OBJECT as HTMLProps,
      popupProps: EMPTY_OBJECT as HTMLProps,
    } as Pick<Readonly<State>, PopupInteractionPropKey>);
  });
}
