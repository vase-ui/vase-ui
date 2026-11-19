import type { HTMLAttributes } from 'vue';
import { bindPopupParts } from './popupBindings';
import type { PopupStoreState, PopupTriggerDataStore } from './usePopupRoot';

function useTypeTests(
  store: PopupTriggerDataStore<PopupStoreState<unknown>>,
  props: HTMLAttributes,
) {
  bindPopupParts(store, { trigger: () => props, popup: () => props });
  bindPopupParts(store, { trigger: () => props, inactiveTrigger: () => props, popup: () => props });
  // @ts-expect-error A trigger needs a popup.
  bindPopupParts(store, { trigger: () => props });
  // @ts-expect-error A popup must supply attributes.
  bindPopupParts(store, { trigger: () => props, popup: () => 'invalid' });
}

void useTypeTests;
