import { computed, getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { PopupStoreState, PopupTriggerDataStore } from './store';

type Store = Pick<PopupTriggerDataStore<PopupStoreState<unknown>>, 'state' | 'update'>;

interface PopupParts {
  trigger(): HTMLAttributes;
  inactiveTrigger?(): HTMLAttributes;
  popup(): HTMLAttributes;
}

interface PopupBindings {
  trigger(active: boolean): HTMLAttributes;
  popup(): HTMLAttributes;
  expose(): void;
}

// A detached trigger can reach the owner only through its handle.
const bindings = new WeakMap<object, PopupBindings>();

export function bindPopupParts(store: Store, parts: PopupParts) {
  const scope = getCurrentScope();
  const trigger = computed(parts.trigger);
  const inactive = parts.inactiveTrigger ? computed(parts.inactiveTrigger) : trigger;
  const popup = computed(parts.popup);
  const exposed = shallowRef(false);
  bindings.set(store, {
    trigger(active) {
      if (exposed.value) {
        return active ? store.state.activeTriggerProps : store.state.inactiveTriggerProps;
      }
      return active ? trigger.value : inactive.value;
    },
    popup: () => (exposed.value ? store.state.popupProps : popup.value),
    expose() {
      if (exposed.value) {
        return;
      }
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
      exposed.value = true;
    },
  });
  onScopeDispose(() => {
    bindings.delete(store);
    if (exposed.value) {
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
