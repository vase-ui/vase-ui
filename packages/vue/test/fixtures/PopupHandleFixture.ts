import type { InjectionKey } from 'vue';
import { NOOP } from '../../src/common/empty';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { NullStore } from '../../src/utils/popups/NullStore';
import { BasePopupHandle } from '../../src/utils/popups/popupHandle';
import { PopupTriggerMap } from '../../src/utils/popups/popupTriggerMap';
import { ReactiveStore } from '../../src/utils/popups/ReactiveStore';

export interface PopupHandleFixtureState {
  open: boolean;
  activeTriggerId: string | undefined;
}

interface Context {
  triggerElements: PopupTriggerMap;
}

const selectors = {
  open: (state: PopupHandleFixtureState) => state.open,
  isOpenedByTrigger: (state: PopupHandleFixtureState, triggerId: string) =>
    state.open && state.activeTriggerId === triggerId,
};

/** The store that a root makes. */
export class PopupHandleFixtureStore extends ReactiveStore<
  PopupHandleFixtureState,
  Context,
  typeof selectors
> {
  constructor(state: Partial<PopupHandleFixtureState> = {}) {
    super(
      { open: false, activeTriggerId: undefined, ...state },
      { triggerElements: new PopupTriggerMap() },
      selectors,
    );
  }

  setOpen(open: boolean, _eventDetails: VaseUIChangeEventDetails<string>) {
    this.set('open', open);
  }
}

type HandleStore = Pick<PopupHandleFixtureStore, 'select' | 'context' | 'setOpen'>;

/** The inert store of a handle: a frozen state and a frozen context. */
function createNullStore(): HandleStore {
  const store = new NullStore<Readonly<PopupHandleFixtureState>, Context, typeof selectors>(
    Object.freeze({ open: false, activeTriggerId: undefined }),
    Object.freeze({ triggerElements: new PopupTriggerMap() }),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

export class PopupHandleFixture extends BasePopupHandle<HandleStore, PopupHandleFixtureStore> {
  constructor() {
    super(createNullStore(), 'Fixture');
  }

  get isOpen() {
    return this.attachedStore?.select('open') ?? false;
  }

  get fallback() {
    return this.fallbackStore;
  }
}

export function createPopupHandleFixture() {
  return new PopupHandleFixture();
}

export const PopupHandleFixtureContext: InjectionKey<PopupHandleFixtureStore> = Symbol();
