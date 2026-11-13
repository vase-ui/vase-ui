import { BasePopupStore } from './store';
import type {
  PopupOpenChangeEventDetails,
  PopupOpenChangeState,
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerDataStore,
  PopupUnmountState,
  popupStoreSelectors,
} from './store';
import type { PositioningInteractionStore } from './types';

type TestState = PopupStoreState<unknown> & {
  instantType: 'dismiss' | 'focus' | undefined;
  extra: number;
};

class TestPopupStore extends BasePopupStore<
  TestState,
  PopupStoreContext<PopupOpenChangeEventDetails>,
  typeof popupStoreSelectors,
  PopupOpenChangeEventDetails
> {}

function useTypeTests(store: TestPopupStore) {
  const openChange: PopupOpenChangeState<TestState>[] = [
    {},
    { instantType: 'focus' },
    { instantType: undefined },
    { extra: 1 },
    // @ts-expect-error Fields must use their declared value type.
    { extra: 'invalid' },
    // @ts-expect-error The base store commits the open state, and a step does not.
    { open: true },
    // @ts-expect-error The base store commits the active trigger, and a step does not.
    { activeTriggerElement: null },
    // @ts-expect-error The base store commits the open change reason, and a step does not.
    { openChangeReason: null },
    // @ts-expect-error A step can return only fields of the state of the store.
    { unknownField: true },
  ];

  const unmount: PopupUnmountState<TestState>[] = [
    { extra: 0 },
    // @ts-expect-error The base store resets `mounted` on unmount.
    { mounted: false },
    // @ts-expect-error The base store resets the active trigger on unmount.
    { activeTriggerId: null },
  ];

  // A popup store is the store that the interaction composables and positioning read and write.
  const positioningStore: PositioningInteractionStore = store;
  // The registration of a trigger takes the store of each family as this narrower type.
  const triggerDataStore: PopupTriggerDataStore<TestState> = store;

  return [openChange, unmount, positioningStore, triggerDataStore];
}

void useTypeTests;
