import { shallowRef } from 'vue';
import type { VaseUIChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import type { REASONS } from '../../src/internals/reasons';
import {
  createInitialPopupStoreState,
  createPopupStoreContext,
} from '../../src/utils/popups/store';
import {
  ValuePopupStore,
  valuePopupSelectors,
} from '../../src/utils/popups/value-popup/ValuePopupStore';
import type {
  ValuePopupContext,
  ValuePopupState,
} from '../../src/utils/popups/value-popup/ValuePopupStore';

// The fixture family of the value popup: a store that anchors to its trigger element, like the
// stores of Select and Combobox.

/**
 * The change details of the fixture store. A narrower union than the base type, so a test can see
 * that a root composable gives the details type of the store and not `never`.
 */
export type ValuePopupFixtureDetails = VaseUIChangeEventDetails<
  | typeof REASONS.triggerPress
  | typeof REASONS.itemPress
  | typeof REASONS.escapeKey
  | typeof REASONS.imperativeAction
  | typeof REASONS.none
> & { preventUnmountOnClose(): void };

type Context = ValuePopupContext<ValuePopupFixtureDetails>;

function createInitialState(
  initialState: Partial<ValuePopupState> | undefined,
  defaultPopupId: string | undefined,
): ValuePopupState {
  return {
    ...createInitialPopupStoreState<unknown>(defaultPopupId),
    id: undefined,
    labelId: undefined,
    isItemEqualToValue: Object.is,
    selectedValue: null,
    selectionMode: 'single',
    forceMounted: false,
    openMethod: null,
    activeIndex: null,
    selectedIndex: null,
    triggerElement: null,
    listElement: null,
    popupSide: null,
    disabled: false,
    readOnly: false,
    required: false,
    modal: false,
    ...initialState,
  };
}

function createContext(): Context {
  return {
    ...createPopupStoreContext(),
    listRef: shallowRef<Array<HTMLElement | null>>([]),
    labelsRef: shallowRef<Array<string | null>>([]),
    valuesRef: shallowRef<Array<any>>([]),
  };
}

export class ValuePopupFixtureStore extends ValuePopupStore<
  ValuePopupState,
  Context,
  typeof valuePopupSelectors,
  ValuePopupFixtureDetails
> {
  constructor(initialState?: Partial<ValuePopupState>, defaultPopupId?: string) {
    super(createInitialState(initialState, defaultPopupId), createContext(), valuePopupSelectors);
  }

  protected getAnchorElement(state: Readonly<ValuePopupState>) {
    return state.triggerElement;
  }
}
