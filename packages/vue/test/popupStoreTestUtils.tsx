import { vi } from 'vitest';
import { defineComponent, watch } from 'vue';
import type { PropType } from 'vue';
import type { VaseUIChangeEventDetails } from '../src/internals/createBaseUIEventDetails';
import { ReactiveStore } from '../src/utils/popups/ReactiveStore';
import {
  useTriggerDataForwarding,
  useTriggerRegistration,
} from '../src/utils/popups/popupStoreUtils';
import {
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
} from '../src/utils/popups/store';
import type {
  PopupStoreContext,
  PopupStoreSelectors,
  PopupStoreState,
} from '../src/utils/popups/store';

export type TestPopupStore = ReactiveStore<
  Readonly<PopupStoreState<unknown>>,
  PopupStoreContext<unknown>,
  PopupStoreSelectors
> & {
  setOpen: (open: boolean, eventDetails: VaseUIChangeEventDetails<string>) => void;
};

/**
 * Creates a bare popup store whose `setOpen` only writes `open`.
 */
export function createTestPopupStore() {
  const store = new ReactiveStore<
    Readonly<PopupStoreState<unknown>>,
    PopupStoreContext<unknown>,
    PopupStoreSelectors
  >(
    createInitialPopupStoreState(),
    createPopupStoreContext(),
    popupStoreSelectors,
  ) as TestPopupStore;

  store.setOpen = vi.fn((open: boolean) => {
    store.set('open', open);
  });

  return store;
}

const triggerProps = {
  id: { type: String, required: true },
  store: { type: Object as PropType<TestPopupStore>, required: true },
  element: { type: Object as PropType<HTMLElement>, required: true },
} as const;

/**
 * Registers `element` as a trigger of `store`.
 */
export const TestTrigger = defineComponent({
  props: { ...triggerProps, repeat: { type: Number, default: 1 } },
  setup(props) {
    const { registerTrigger } = useTriggerRegistration(
      () => props.id,
      () => props.store,
    );

    // Vue calls a function `ref` again on each patch. The calls must change nothing.
    for (let i = 0; i < props.repeat; i += 1) {
      registerTrigger(props.element);
    }
    watch(() => props.element, registerTrigger);

    return () => null;
  },
});

/**
 * Registers `element` as a trigger of `store` and forwards `payload` while it is active.
 */
export const TestForwardedTrigger = defineComponent({
  props: { ...triggerProps, payload: null },
  setup(props) {
    const { registerTrigger } = useTriggerDataForwarding(
      () => props.id,
      () => props.store,
      () => ({ payload: props.payload }),
    );

    registerTrigger(props.element);
    watch(() => props.element, registerTrigger);

    return () => null;
  },
});
