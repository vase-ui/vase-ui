import { toRaw } from 'vue';
import type { ComputedRef, HTMLAttributes, ShallowRef } from 'vue';
import { compareItemEquality } from '../internals/itemEquality';
import type { RegisterId } from '../internals/labelable-provider/LabelableContext';
import { hasNullItemLabel } from '../internals/resolveValueLabel';
import type { AdaptiveOriginMiddleware } from '../utils/popups/positioning/adaptiveOriginConstants';
import { popupStoreSelectors } from '../utils/popups/store';
import type { PopupInteractionReader, PositioningInteractionStore } from '../utils/popups/types';
import { ValuePopupStore, valuePopupSelectors } from '../utils/popups/value-popup/ValuePopupStore';
import type {
  ValuePopupContext,
  ValuePopupState,
} from '../utils/popups/value-popup/ValuePopupStore';
import type { AriaCombobox } from './root/AriaCombobox';

export type State = ValuePopupState & {
  items: readonly any[] | undefined;

  inline: boolean;

  listProps: HTMLAttributes;
  inputProps: HTMLAttributes;
  // The values of the root that each item reads. They are one object, so an item reads one key of
  // the state for all of them.
  itemRoot: {
    props: HTMLAttributes;
    id: string | undefined;
    selectionMode: ValuePopupState['selectionMode'];
    disabled: boolean;
    readOnly: boolean;
    isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;
  };

  /**
   * The id of the popup element. While the input is inside the popup, the `aria-controls` of the
   * trigger names it.
   */
  popupElementId: string | undefined;
  inputElement: HTMLInputElement | null;
  inputGroupElement: HTMLDivElement | null;

  inputInsidePopup: boolean;
  inputOwnsFormValue: boolean;

  name: string | undefined;
  form: string | undefined;
  grid: boolean;
  virtualized: boolean;
  openOnInputClick: boolean;
  autoHighlight: false | 'always' | 'input-change';
  submitOnItemClick: boolean;
  hasInputValue: boolean;

  // The shared positioner reads these keys. A combobox has no instant transition and no adaptive
  // origin, so they stay `undefined`.
  instantType: undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

/**
 * The values that the parts of Combobox share and that no part renders. No selector reads them.
 */
export type ComboboxStoreContext = ValuePopupContext<AriaCombobox.OpenChangeEventDetails> & {
  /** The empty-state element. */
  readonly emptyRef: ShallowRef<HTMLDivElement | null>;
  /** The input element that has the combobox role. */
  readonly inputRef: ShallowRef<HTMLInputElement | null>;
  /** The internal dismiss button before the popup content. */
  readonly startDismissRef: ShallowRef<HTMLSpanElement | null>;
  /** The internal dismiss button after the popup content. */
  readonly endDismissRef: ShallowRef<HTMLSpanElement | null>;
  /** The container of the selection chips. */
  readonly chipsContainerRef: ShallowRef<HTMLDivElement | null>;
  /** The clear button. */
  readonly clearRef: ShallowRef<HTMLButtonElement | null>;
  /** The item element that got the last `pointerdown`, to pair it with a `mouseup`. */
  readonly pointerDownItemRef: ShallowRef<Element | null>;
  /** The native event of the selection in progress. */
  readonly selectionEventRef: ShallowRef<MouseEvent | PointerEvent | KeyboardEvent | null>;
  /**
   * The id of the last `Combobox.Label` that has one. A label registers in `setup`, so the trigger
   * has the id in the server HTML. The state gets it only in a watcher, which a server does not run.
   */
  readonly labelId: ComputedRef<string | undefined>;
  readonly registerLabelId: RegisterId;

  // The commands. The store starts with `NOOP` for each one, and the root assigns them in `setup`.
  // Thus they are not `readonly`.

  /** Clears what the open session left behind after the popup unmounts. */
  handleUnmount: () => void;
  /** Sets the input value. */
  setInputValue: (value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  /** Sets the selected value. */
  setSelectedValue: (value: any, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  /** Sets the active index, the selected index, or both. */
  setIndices: (indices: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
    event?: Event | undefined;
  }) => void;
  /** Mounts the popup content and keeps it closed, so that the labels of the items resolve. */
  forceMount: () => void;
  /** Applies the selection of an item. */
  handleSelection: (event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) => void;
  /** Requests the submit of the form of the combobox. */
  requestSubmit: () => void;
};

export const selectors = {
  ...valuePopupSelectors,
  items: (state: State) => state.items,
  hasNullItemLabel: (state: State, enabled: boolean) =>
    enabled ? hasNullItemLabel(state.items) : false,

  hasSelectionChips: (state: State) => {
    const selectedValue = state.selectedValue;
    return Array.isArray(selectedValue) && selectedValue.length > 0;
  },

  hasSelectedValue: (state: State) => {
    const { selectedValue, selectionMode } = state;
    if (selectedValue == null) {
      return false;
    }
    if (selectionMode === 'multiple' && Array.isArray(selectedValue)) {
      return selectedValue.length > 0;
    }
    return true;
  },

  inline: (state: State) => state.inline,

  isSelected: (state: State, itemValue: any) => {
    const comparer = state.isItemEqualToValue;
    const selectedValue = state.selectedValue;
    if (Array.isArray(selectedValue)) {
      return selectedValue.some((selectedItem) =>
        compareItemEquality(itemValue, selectedItem, comparer),
      );
    }
    return compareItemEquality(itemValue, selectedValue, comparer);
  },

  listProps: (state: State) => state.listProps,
  inputProps: (state: State) => state.inputProps,
  itemRoot: (state: State) => state.itemRoot,

  popupElementId: (state: State) => state.popupElementId,
  inputElement: (state: State) => state.inputElement,
  inputGroupElement: (state: State) => state.inputGroupElement,
  // See `interactions`.
  interactionOpen: (state: State) => popupStoreSelectors.open(state) || state.inline,
  // The shared selector hides the positioner while a popup that opens mounts. The list navigation
  // reads that as the removal of the list, and it resets the highlight that the typed text set.
  interactionPositionerElement: (state: State) => state.positionerElement,

  inputInsidePopup: (state: State) => state.inputInsidePopup,
  inputOwnsFormValue: (state: State) => state.inputOwnsFormValue,

  name: (state: State) => state.name,
  form: (state: State) => state.form,
  grid: (state: State) => state.grid,
  virtualized: (state: State) => state.virtualized,
  autoHighlight: (state: State) => state.autoHighlight,
  instantType: (state: State) => state.instantType,
  adaptiveOrigin: (state: State) => state.adaptiveOrigin,
};

export class ComboboxStore extends ValuePopupStore<
  State,
  ComboboxStoreContext,
  typeof selectors,
  AriaCombobox.OpenChangeEventDetails
> {
  /**
   * The store that the interaction composables read. An inline list renders while it is in the
   * tree, so the composables see it as open (`interactionOpen`) also while the open state is
   * `false`. They also see the positioner element while it is in the DOM. Each other key is the
   * key of the store itself.
   */
  readonly interactions: PositioningInteractionStore = createInteractionView(this);

  // The input, or the trigger when the input is inside the popup.
  protected getAnchorElement(state: Readonly<State>) {
    return state.inputInsidePopup ? state.triggerElement : state.inputElement;
  }

  // The input requests an open at each key press and at each press. Only a request that changes
  // the open state is an open change.
  protected override isOpenChangeIgnored(nextOpen: boolean) {
    return nextOpen === popupStoreSelectors.open(toRaw(this.state));
  }

  protected override prepareUnmount() {
    this.context.handleUnmount();
    return {};
  }
}

type InteractionKey =
  'open' | 'transitionStatus' | 'anchorElement' | 'anchor' | 'positionerElement' | 'defaultPopupId';

function createInteractionView(store: ComboboxStore): PositioningInteractionStore {
  const getKey = (key: InteractionKey): keyof typeof selectors => {
    if (key === 'open') {
      return 'interactionOpen';
    }
    return key === 'positionerElement' ? 'interactionPositionerElement' : key;
  };

  return {
    select: ((key: InteractionKey) => store.select(getKey(key))) as PopupInteractionReader,
    set: (key: 'anchorOverride' | 'anchorElement', value: any) => store.set(key, value),
    setOpen: store.setOpen,
    context: store.context,
    clearPositioning: () => store.clearPositioning(),
  };
}
