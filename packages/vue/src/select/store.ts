import type { ComputedRef, ShallowRef } from 'vue';
import { compareItemEquality } from '../internals/itemEquality';
import type { RegisterId } from '../internals/labelable-provider/LabelableContext';
import { hasNullItemLabel, stringifyAsValue } from '../internals/resolveValueLabel';
import type { Group, ItemLabel } from '../internals/resolveValueLabel';
import { popupStoreSelectors } from '../utils/popups/store';
import type { InteractionProps } from '../utils/popups/types';
import { ValuePopupStore, valuePopupSelectors } from '../utils/popups/value-popup/ValuePopupStore';
import type {
  ValuePopupContext,
  ValuePopupState,
} from '../utils/popups/value-popup/ValuePopupStore';
import type {
  SelectRootChangeEventDetails,
  SelectRootOpenChangeEventDetails,
} from './root/SelectRoot.vue';

export type SelectItems =
  | Record<string, ItemLabel>
  | ReadonlyArray<{ label: ItemLabel; value: any }>
  | ReadonlyArray<Group<any>>
  | undefined;

export type State = ValuePopupState & {
  items: SelectItems;
  highlightItemOnHover: boolean;
  itemToStringValue: ((item: any) => string) | undefined;

  // Root values every item reads, combined so each item needs a single read for them.
  itemRoot: {
    props: InteractionProps;
    multiple: boolean;
    disabled: boolean;
    readOnly: boolean;
    isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;
  };
  listElement: HTMLDivElement | null;

  scrollUpArrowVisible: boolean;
  scrollDownArrowVisible: boolean;

  hasScrollArrows: boolean;
};

/**
 * A ref of Base UI that only handlers read. A plain holder, because no part renders it.
 */
interface Holder<T> {
  value: T;
}

/**
 * Values that no selector gives to the select parts. A write to them renders nothing, except
 * `labelId`, which the trigger reads in its render.
 */
export type SelectStoreContext = ValuePopupContext<SelectRootOpenChangeEventDetails> & {
  readonly scrollHandlerRef: ShallowRef<((element: HTMLDivElement) => void) | null>;
  readonly valueRef: ShallowRef<HTMLSpanElement | null>;
  readonly typingRef: Holder<boolean>;
  readonly selectionRef: Holder<{
    allowUnselectedMouseUp: boolean;
    allowSelectedMouseUp: boolean;
    dragY: number;
  }>;
  readonly firstItemTextRef: Holder<HTMLElement | null>;
  readonly selectedItemTextRef: Holder<HTMLElement | null>;
  readonly alignItemWithTriggerActiveRef: Holder<boolean>;
  readonly initialValueRef: Holder<any>;
  /**
   * The value of each item, by the element of the item.
   */
  readonly itemValues: WeakMap<Element, any>;
  /**
   * The id of the last `Select.Label` that has one. A label registers in `setup`, so the trigger
   * has the id in the server HTML. The state gets it only in a watcher, which a server does not run.
   */
  readonly labelId: ComputedRef<string | undefined>;
  readonly registerLabelId: RegisterId;

  // Callbacks. The root assigns them in `setup`, so they are not `readonly`.
  isItemEqualToValue: State['isItemEqualToValue'];
  /**
   * Returns `false` when a listener cancels the change.
   */
  setValue: (nextValue: any, eventDetails: SelectRootChangeEventDetails) => boolean;
  handleScrollArrowVisibility: (scroller: HTMLElement) => void;
  /**
   * Counts a mounted scroll arrow and returns the function that removes the count. The state
   * `hasScrollArrows` is `true` while the count is more than zero.
   */
  registerScrollArrow: () => () => void;
};

export const selectors = {
  ...valuePopupSelectors,
  items: (state: State) => state.items,
  hasNullItemLabel: (state: State, enabled: boolean) =>
    enabled ? hasNullItemLabel(state.items) : false,
  multiple: (state: State) => state.selectionMode === 'multiple',
  highlightItemOnHover: (state: State) => state.highlightItemOnHover,

  hasSelectedValue: (state: State) => {
    const { selectedValue, itemToStringValue } = state;
    if (selectedValue == null) {
      return false;
    }
    if (state.selectionMode === 'multiple' && Array.isArray(selectedValue)) {
      return selectedValue.length > 0;
    }

    return stringifyAsValue(selectedValue, itemToStringValue) !== '';
  },

  // `open` is the effective open state, so a controlled `open` prop counts.
  isActiveWhileOpen: (state: State, index: number) =>
    popupStoreSelectors.open(state) && state.activeIndex === index,

  isSelected: (state: State, itemValue: any) => {
    const comparer = state.isItemEqualToValue;
    const selectedValue = state.selectedValue;

    if (state.selectionMode === 'multiple') {
      return (
        Array.isArray(selectedValue) &&
        selectedValue.some((selectedItem) => compareItemEquality(itemValue, selectedItem, comparer))
      );
    }

    // The value is the source of truth: a stale `selectedIndex` (e.g. the controlled
    // value changes while the popup is open, where the index sync is deferred) must not
    // keep a previously selected item marked as selected.
    return compareItemEquality(itemValue, selectedValue, comparer);
  },
  isSelectedByFocus: (state: State, index: number) => {
    return state.selectedIndex === index;
  },

  itemRoot: (state: State) => state.itemRoot,

  scrollUpArrowVisible: (state: State) => state.scrollUpArrowVisible,
  scrollDownArrowVisible: (state: State) => state.scrollDownArrowVisible,

  hasScrollArrows: (state: State) => state.hasScrollArrows,
};

export class SelectStore extends ValuePopupStore<
  State,
  SelectStoreContext,
  typeof selectors,
  SelectRootOpenChangeEventDetails
> {
  protected getAnchorElement(state: Readonly<State>) {
    return state.triggerElement;
  }

  protected override prepareUnmount() {
    return {
      activeIndex: null,
      openMethod: null,
      scrollUpArrowVisible: false,
      scrollDownArrowVisible: false,
    };
  }
}
