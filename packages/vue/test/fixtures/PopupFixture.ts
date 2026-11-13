import type { InjectionKey } from 'vue';
import { NOOP } from '../../src/common/empty';
import { NullStore } from '../../src/utils/popups/NullStore';
import type { AdaptiveOriginMiddleware } from '../../src/utils/popups/positioning/adaptiveOriginConstants';
import { BasePopupHandle } from '../../src/utils/popups/popupHandle';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  getHoverPopupInstantType,
  popupStoreSelectors,
} from '../../src/utils/popups/store';
import type {
  PopupOpenChangeEventDetails,
  PopupStoreContext,
  PopupStoreState,
  PopupTriggerStoreKeys,
} from '../../src/utils/popups/store';

// The fixture family of the popup root: a store with keys of its own, its handle, and the key of
// its context. `PopupRootPart`, `PopupTriggerPart`, `PopupPositionerPart` and `PopupPart` are its
// parts.

export type PopupFixtureState<Payload> = PopupStoreState<Payload> & {
  instantType: 'dismiss' | 'focus' | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type Context = PopupStoreContext<PopupOpenChangeEventDetails>;

const selectors = {
  ...popupStoreSelectors,
  instantType: (state: PopupFixtureState<unknown>) => state.instantType,
  adaptiveOrigin: (state: PopupFixtureState<unknown>) => state.adaptiveOrigin,
};

type Selectors = typeof selectors;

function createInitialState<Payload>(
  initialState?: Partial<PopupFixtureState<Payload>>,
  defaultPopupId?: string,
): PopupFixtureState<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(defaultPopupId),
    instantType: undefined,
    adaptiveOrigin: undefined,
    ...initialState,
  };
}

export class PopupFixtureStore<Payload> extends BasePopupStore<
  PopupFixtureState<Payload>,
  Context,
  Selectors,
  PopupOpenChangeEventDetails
> {
  constructor(initialState: Partial<PopupFixtureState<Payload>>, defaultPopupId?: string) {
    super(
      createInitialState<Payload>(initialState, defaultPopupId),
      createPopupStoreContext(),
      selectors,
    );
  }

  protected override prepareOpenChange(
    nextOpen: boolean,
    eventDetails: PopupOpenChangeEventDetails,
  ) {
    return getHoverPopupInstantType(nextOpen, eventDetails.reason);
  }
}

export type PopupFixtureHandleStore<Payload> = Pick<
  PopupFixtureStore<Payload>,
  PopupTriggerStoreKeys | 'setOpen'
>;

function createNullStore<Payload>(): PopupFixtureHandleStore<Payload> {
  const store = new NullStore<Readonly<PopupFixtureState<Payload>>, Context, Selectors>(
    Object.freeze(createInitialState<Payload>()),
    Object.freeze(createPopupStoreContext()),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP });
}

export class PopupFixtureHandle<Payload> extends BasePopupHandle<
  PopupFixtureHandleStore<Payload>,
  PopupFixtureStore<Payload>
> {
  constructor() {
    super(createNullStore<Payload>(), 'PopupFixture');
  }

  open(triggerId: string) {
    this.openByTrigger(triggerId);
  }

  close() {
    this.closePopup();
  }

  get isOpen() {
    return this.attachedStore?.select('open') ?? false;
  }
}

export function createPopupFixtureHandle<Payload>() {
  return new PopupFixtureHandle<Payload>();
}

export const PopupFixtureContext: InjectionKey<PopupFixtureStore<any>> = Symbol();
