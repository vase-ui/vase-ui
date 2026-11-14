import { EMPTY_OBJECT, NOOP } from '../common/empty';
import { NullStore } from '../utils/popups/NullStore';
import { ReactiveStore } from '../utils/popups/ReactiveStore';

export type State = {
  visibleItemIds: ReadonlySet<symbol> | null;
  registeredItemCount: number;
};

export const selectors = {
  // A null `visibleItemIds` means no query, so fall back to whether anything registered.
  isEmpty: (state: State) =>
    state.visibleItemIds === null
      ? state.registeredItemCount === 0
      : state.visibleItemIds.size === 0,
  isItemVisible: (state: State, id: symbol) =>
    state.visibleItemIds === null || state.visibleItemIds.has(id),
};

export class FilterDropdownStore extends ReactiveStore<State, object, typeof selectors> {
  constructor() {
    super({ visibleItemIds: null, registeredItemCount: 0 }, EMPTY_OBJECT, selectors);
  }
}

/**
 * Stand-in for an item whose owning dropdown is absent, such as a filterable submenu's trigger
 * inside a plain parent menu. Nothing registers and every item stays visible.
 */
export const DETACHED_OWNER = {
  registerItem: () => NOOP,
  // All apps and all server requests share this object, so its store takes no write.
  store: new NullStore<State, object, typeof selectors>(
    Object.freeze({ visibleItemIds: null, registeredItemCount: 0 }),
    EMPTY_OBJECT,
    selectors,
  ),
};
