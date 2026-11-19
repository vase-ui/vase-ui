import { computed, getCurrentScope, onScopeDispose, watch } from 'vue';
import type { InteractionType } from './usePopupTrigger';
import { FOCUSABLE_ATTRIBUTE } from './constants';
import type { HTMLAttributes, Ref } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { PopupStoreState, PopupTriggerDataStore } from './usePopupRoot';

type Store = Pick<PopupTriggerDataStore<PopupStoreState<unknown>>, 'state' | 'update'>;

interface PopupParts {
  trigger: () => HTMLAttributes;
  inactiveTrigger?: () => HTMLAttributes;
  popup: () => HTMLAttributes;
}

interface PopupBindings {
  trigger(active: boolean): HTMLAttributes;
  popup: () => HTMLAttributes;
  expose(): void;
}

// A detached trigger can reach the owner only through its handle.
const bindings = new WeakMap<object, PopupBindings>();

export function bindPopupParts(store: Store, parts: PopupParts) {
  const scope = getCurrentScope();
  const trigger = computed(parts.trigger);
  const inactive = parts.inactiveTrigger ? computed(parts.inactiveTrigger) : trigger;
  const popup = computed(parts.popup);
  let exposed = false;
  bindings.set(store, {
    trigger(active) {
      const value = active ? store.state.activeTriggerProps : store.state.inactiveTriggerProps;
      const current = active ? trigger : inactive;
      return exposed ? value : current.value;
    },
    popup() {
      const value = store.state.popupProps;
      return exposed ? value : popup.value;
    },
    expose() {
      if (exposed) {
        return;
      }
      exposed = true;
      // Only a handle reader needs writable copies of these three public fields.
      scope?.run(() => {
        watch(
          [trigger, inactive, popup],
          ([activeTriggerProps, inactiveTriggerProps, popupProps]) => {
            store.update({ activeTriggerProps, inactiveTriggerProps, popupProps });
          },
          { immediate: true },
        );
      });
    },
  });
  onScopeDispose(() => {
    bindings.delete(store);
    if (exposed) {
      store.update({
        activeTriggerProps: EMPTY_OBJECT,
        inactiveTriggerProps: EMPTY_OBJECT,
        popupProps: EMPTY_OBJECT,
      });
    }
  });
}

export function triggerBindings(store: Pick<Store, 'state'>, active: boolean) {
  return (
    bindings.get(store)?.trigger(active) ??
    (active ? store.state.activeTriggerProps : store.state.inactiveTriggerProps)
  );
}

export function popupBindings(store: Pick<Store, 'state'>) {
  return bindings.get(store)?.popup() ?? store.state.popupProps;
}

export function exposePopupBindings(store: object) {
  bindings.get(store)?.expose();
}

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
