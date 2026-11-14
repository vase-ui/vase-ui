import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  provide,
  shallowRef,
  toRaw,
  watch,
} from 'vue';
import type { ComputedRef, HTMLAttributes, ShallowRef } from 'vue';
import { getOverflowAncestors } from '@floating-ui/vue';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../common/addEventListener';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../common/empty';
import { useIsHydrating } from '../../common/hydration';
import { ownerWindow } from '../../common/owner';
import { activeElement, closest, contains, getTarget } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  VaseUIChangeEventDetails,
  VaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { getFilter } from '../../internals/filter';
import { useFormContext } from '../../internals/form-context';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  findSelectionIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../../internals/itemEquality';
import { createLabelIdRegistry, useLabelableId } from '../../internals/labelable-provider';
import { NOOP } from '../../internals/noop';
import { REASONS } from '../../internals/reasons';
import {
  flattenLeafItems,
  isGroupedItems,
  stringifyAsLabel,
  stringifyAsValue,
} from '../../internals/resolveValueLabel';
import type { Group } from '../../internals/resolveValueLabel';
import type { VaseUIEvent } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useValueChanged } from '../../internals/useValueChanged';
import { mergeProps } from '../../merge-props';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { gridNavigation } from '../../utils/popups/interactions/gridNavigation';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useListNavigation } from '../../utils/popups/interactions/useListNavigation';
import { useOpenInteractionType } from '../../utils/popups/interactions/useOpenInteractionType';
import { useSingleAnchorPopupRoot } from '../../utils/popups/popupRoot';
import {
  FOCUSABLE_POPUP_PROPS,
  usePopupInteractionProps,
} from '../../utils/popups/popupStoreUtils';
import { createInitialPopupStoreState, createPopupStoreContext } from '../../utils/popups/store';
import { isScrollableY } from '../../utils/scrollable';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { findCollectionItem } from '../items/itemCollection';
import type { ComboboxItemCollection, ItemCollection } from '../items/itemCollection';
import { ComboboxStore, selectors } from '../store';
import type { State as StoreState } from '../store';
import {
  ComboboxDerivedItemsContext,
  ComboboxHasItemsContext,
  ComboboxInputValueContext,
  ComboboxRootContext,
} from './ComboboxRootContext';
import type { ComboboxInputElementValue } from './ComboboxRootContext';
import { createCollatorItemFilter } from './utils';
import type { FilterItemToString } from './utils';
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from './utils/constants';

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = 'none', Item = Value> = AriaComboboxProps<
    Value,
    Mode,
    Item
  >;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
    close: () => void;
  }

  export type HighlightEventReason =
    typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = VaseUIHighlightEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.imperativeAction
    | typeof REASONS.none;
  export type OpenChangeEventDetails = ChangeEventDetails & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
  export type ChangeEventDetails = VaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}

export type SelectionMode = 'single' | 'multiple' | 'none';

export type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends 'multiple'
  ? ItemValue[]
  : ItemValue;

export interface AriaComboboxProps<Value, Mode extends SelectionMode = 'none', Item = Value> {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   * - `none`: Do not remember the selected value.
   */
  selectionMode: Mode;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: ComboboxInputElementValue;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: ComboboxInputElementValue;
  /**
   * INTERNAL: Whether the consumer controls the input value. A native reset changes no controlled
   * value. A root part that makes `inputValue` from a state of its own gives this prop, because
   * its `inputValue` is never `undefined`. With `undefined`, the input value is controlled when
   * `inputValue` is not `undefined`.
   */
  inputValueControlled?: boolean | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be a flat array of items, an array of groups with items, or a collection created by
   * the `createItems()` function, which derives each item's selection value and label.
   * Nullish entries are not supported: remove them from the data before passing it.
   *
   * A change of a reactive list in place shows in the list. To put the label of the selected value
   * back in an input that the user cleared, give a new list.
   */
  items?: readonly any[] | readonly Group<any>[] | ComboboxItemCollection<Item, Value> | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * With a `createItems()` collection, pass source items rather than derived values.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   * Receives the source item, which is the derived value's item when `items` is a `createItems()`
   * collection, and the item itself otherwise.
   */
  filter?:
    | null
    | ((item: Item, query: string, itemToString?: (item: Item) => string) => boolean)
    | undefined;
  /**
   * INTERNAL: The query that the filter uses in place of the trimmed input value.
   */
  filterQuery?: string | undefined;
  /**
   * When the item values are objects (`<Combobox.Item :value="object">`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value, and the collection's
   * `getLabel` takes precedence for values it can resolve.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item :value="object">`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * With a `createItems()` collection, both arguments are derived values.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   *
   * In a `Combobox.Root` > `Dialog.Root` composition, bind `v-model:open` of the Combobox to the
   * open state of the `Dialog` instead so the component resets its transient state (filter query,
   * highlighted item, and input value) when the dialog closes.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   * With no `locale`, the filter uses `en-US` until the root is mounted.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

/**
 * The props that a root part gives to `useAriaCombobox`. Each key is required, so a root names
 * each prop. A prop that the root does not have is `undefined`.
 */
// `Extract` gives the keys as a plain union, so the mapped type copies no `?` modifier. A `-?`
// modifier would also remove `undefined` from the type of each optional prop.
export type AriaComboboxPropsView<Value, Mode extends SelectionMode = 'none', Item = Value> = {
  [Key in Extract<keyof AriaComboboxProps<Value, Mode, Item>, string>]: AriaComboboxProps<
    Value,
    Mode,
    Item
  >[Key];
};

export interface AriaComboboxState {}

/**
 * The functions of the root part. Each change function emits the change event, and then the
 * `update:` event when `details.isCanceled` is `false`.
 */
export interface AriaComboboxCallbacks {
  onSelectedValueChange: (value: any, details: AriaCombobox.ChangeEventDetails) => void;
  onInputValueChange: (value: string, details: AriaCombobox.ChangeEventDetails) => void;
  onOpenChange: (open: boolean, details: AriaCombobox.OpenChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onItemHighlighted: (value: any, details: AriaCombobox.HighlightEventDetails) => void;
}

export interface UseAriaComboboxReturnValue {
  store: ComboboxStore;
  actions: AriaCombobox.Actions;
  /** The hidden input. */
  inputElement: ShallowRef<HTMLInputElement | null>;
  /** The one bound object of the hidden input that has the state of the root. */
  hiddenInputProps: () => Record<string, unknown>;
  /** The serialized values of a multiple selection that has a name. */
  hiddenValues: ComputedRef<string[]>;
  name: ComputedRef<string | undefined>;
  disabled: ComputedRef<boolean>;
}

/**
 * Does the work of the internal root of a combobox: the selected value, the input value, the
 * filter, the popup store, the contexts and the form wiring. Call it in the `setup` of a root part.
 * @param props An object with one getter for each prop of the root part. A read then tracks only
 * that prop.
 * @param callbacks The functions that emit the events of the root part.
 */
export function useAriaCombobox<Value, Mode extends SelectionMode = 'none', Item = Value>(
  props: AriaComboboxPropsView<Value, Mode, Item>,
  callbacks: AriaComboboxCallbacks,
): UseAriaComboboxReturnValue {
  const { clearErrors } = useFormContext();
  const {
    setDirty,
    validityData,
    setFilled,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
    setValidityData,
  } = useFieldRootContext();

  const id = useLabelableId({ id: () => props.id });
  const { labelId, registerLabelId } = createLabelIdRegistry();
  const direction = useDirection();
  const locale = useFormatLocale(() => props.locale);
  const collatorFilter = computed(() => getFilter({ locale: locale.value }));

  const selectionMode = computed<SelectionMode>(() => props.selectionMode);
  const multiple = computed(() => selectionMode.value === 'multiple');
  const single = computed(() => selectionMode.value === 'single');
  const disabled = computed(() => Boolean(fieldDisabled.value || props.disabled));
  const readOnly = computed(() => props.readOnly ?? false);
  const required = computed(() => props.required ?? false);
  const name = computed(() => fieldName.value ?? props.name);
  const grid = computed(() => props.grid ?? false);
  const inlineProp = computed(() => props.inline ?? false);
  const limit = computed(() => props.limit ?? -1);
  const isItemEqualToValue = computed(() => props.isItemEqualToValue ?? defaultItemEquality);
  const hasInputValue = computed(
    () => props.inputValue !== undefined || props.defaultInputValue !== undefined,
  );
  const autoHighlightMode = computed<false | 'input-change' | 'always'>(() => {
    if (props.autoHighlight === 'always') {
      return 'always';
    }
    return props.autoHighlight ? 'input-change' : false;
  });
  const clearFieldError = useClearFieldError(name);

  // Plain items are arrays; normalized `createItems()` collections are objects.
  const collection = computed(() => {
    const itemsProp = props.items;
    const next = Array.isArray(itemsProp)
      ? null
      : (itemsProp as unknown as ItemCollection<Item, Value> | undefined);
    if (next && typeof next.label !== 'function') {
      throw new Error(
        'Vase UI: The `items` prop of Combobox got an object that is not a collection. The root cannot read its items. Give a list of items, a list of groups, or the result of `createItems()`.',
      );
    }
    return next;
  });
  const items = computed(
    () =>
      (collection.value ? collection.value.data : props.items) as
        readonly Item[] | readonly Group<Item>[] | undefined,
  );
  const itemToValue = computed(() => collection.value?.value);
  // A projected collection's items live in the source domain, not the selection-value domain the
  // store matches against, so they are withheld from the store.
  const storeItems = computed(() => (itemToValue.value ? undefined : items.value));
  const hasItems = computed(() => items.value !== undefined);
  const hasFilteredItemsProp = computed(() => props.filteredItems !== undefined);

  // The externally filtered items projected to their selection values, with a lookup back to the
  // source items. Declared before `itemToStringLabel`, which resolves labels from it on the
  // first render (initial input value).
  const externalWindow = computed(() => {
    const filteredItemsProp = props.filteredItems;
    const toValue = itemToValue.value;
    if (!filteredItemsProp || !toValue) {
      return undefined;
    }
    const flat = flattenLeafItems(filteredItemsProp as readonly any[]);
    const values = flat.map(toValue);
    let valueToItem: Map<any, any> | undefined;

    return {
      values,
      findItem(itemValue: any, isEqual: (item: any, value: any) => boolean) {
        if (!valueToItem) {
          valueToItem = new Map();
          for (let i = 0; i < values.length; i += 1) {
            if (!valueToItem.has(values[i])) {
              valueToItem.set(values[i], flat[i]);
            }
          }
        }

        return findCollectionItem(valueToItem, itemValue, isEqual);
      },
    };
  });

  // Labels selection values from current props only: collection data first, then the current
  // external window, then the prop. Nothing from a past window is remembered — keeping a value
  // resolvable over time means keeping its item in the collection's data.
  const itemToStringLabel = computed<((itemValue: any) => string) | undefined>(() => {
    const currentCollection = collection.value;
    const labelProp = props.itemToStringLabel;
    if (!currentCollection) {
      return labelProp;
    }
    const isEqual = isItemEqualToValue.value;
    const currentWindow = externalWindow.value;
    return (itemValue: Value) =>
      currentCollection.label(itemValue, isEqual, (unresolvedValue: any) => {
        const externalItem = currentWindow?.findItem(unresolvedValue, isEqual);
        if (externalItem != null) {
          return currentCollection.itemLabel(externalItem);
        }
        return stringifyAsLabel(unresolvedValue, labelProp);
      });
  });

  const filterItemToString = computed<FilterItemToString | undefined>(() => {
    const currentCollection = collection.value;
    if (!currentCollection) {
      return props.itemToStringLabel as FilterItemToString | undefined;
    }
    const label = itemToStringLabel.value;
    return Object.assign((item: any) => currentCollection.itemLabel(item), {
      selected: (value: any) => stringifyAsLabel(value, label),
    });
  });

  function stringifyValueLabel(item: any) {
    return stringifyAsLabel(item, itemToStringLabel.value);
  }

  const queryChangedAfterOpen = shallowRef(false);
  const closeQuery = shallowRef<string | null>(null);
  let previousCloseQuery = closeQuery.value;

  let hadInputClear = false;
  let lastHighlight = INITIAL_LAST_HIGHLIGHT;
  let pendingQueryHighlight: null | {
    hasQuery: boolean;
    selection?: boolean | undefined;
    // The value a selection-driven clear just added, so the restore can keep it
    // highlighted instead of returning to the open anchor.
    toggledValue?: any;
  } = null;
  const hiddenInputElement = shallowRef<HTMLInputElement | null>(null);

  function getDefaultSelectedValue() {
    const defaultValue = props.defaultSelectedValue ?? null;
    return multiple.value ? (defaultValue ?? EMPTY_ARRAY) : defaultValue;
  }

  const [selectedValue, setSelectedValueUnwrapped] = useControlled<any>({
    controlled: () => props.selectedValue,
    default: getDefaultSelectedValue,
    name: 'Combobox',
    state: 'selectedValue',
  });

  const filter = computed(() => {
    const filterProp = props.filter;
    if (filterProp === null) {
      return () => true;
    }
    if (filterProp !== undefined) {
      return filterProp;
    }
    // `shouldBypassFiltering` already empties the query whenever a single selection's label
    // matches it exactly, so the filter never needs a selection-aware variant here.
    return createCollatorItemFilter(collatorFilter.value, filterItemToString.value);
  });

  // If neither inputValue nor defaultInputValue are provided, derive it from the
  // selected value for single mode so the input reflects the selection on mount.
  const initialDefaultInputValue: ComboboxInputElementValue = hasInputValue.value
    ? (props.defaultInputValue ?? '')
    : single.value
      ? stringifyValueLabel(selectedValue.value)
      : '';

  const [inputValue, setInputValueUnwrapped] = useControlled<ComboboxInputElementValue>({
    controlled: () => props.inputValue,
    default: () => initialDefaultInputValue,
    name: 'Combobox',
    state: 'inputValue',
  });

  const listRef = shallowRef<Array<HTMLElement | null>>([]);
  const labelsRef = shallowRef<Array<string | null>>([]);
  /**
   * Contains the currently visible list of item values post-filtering.
   */
  const valuesRef = shallowRef<any[]>([]);
  const inputRef = shallowRef<HTMLInputElement | null>(null);
  const emptyRef = shallowRef<HTMLDivElement | null>(null);
  const clearRef = shallowRef<HTMLButtonElement | null>(null);
  const chipsContainerRef = shallowRef<HTMLDivElement | null>(null);
  const pointerDownItemRef = shallowRef<Element | null>(null);
  const selectionEventRef = shallowRef<MouseEvent | PointerEvent | KeyboardEvent | null>(null);

  // Support composing the Dialog component around an inline combobox: its transitions wait for
  // the dialog's animations. The root composable takes the element as a ref, and a `post` watcher
  // below points it at that element.
  const animatedPopup = shallowRef<HTMLElement | null>(null);

  const { store, open, transitionStatus, actions } = useSingleAnchorPopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new ComboboxStore(
        {
          ...createInitialPopupStoreState(defaultPopupId),
          ...initialState,
          id: id.value,
          labelId: labelId.value,
          selectedValue: selectedValue.value,
          items: storeItems.value as readonly any[] | undefined,
          selectionMode: selectionMode.value,
          name: name.value,
          form: props.form,
          disabled: disabled.value,
          readOnly: readOnly.value,
          required: required.value,
          grid: grid.value,
          virtualized: props.virtualized ?? false,
          openOnInputClick: props.openOnInputClick ?? true,
          itemToStringLabel: itemToStringLabel.value,
          isItemEqualToValue: isItemEqualToValue.value,
          modal: props.modal ?? false,
          autoHighlight: autoHighlightMode.value,
          submitOnItemClick: props.submitOnItemClick ?? false,
          hasInputValue: hasInputValue.value,
          forceMounted: false,
          inline: inlineProp.value,
          activeIndex: null,
          selectedIndex: null,
          listProps: {},
          inputProps: {},
          itemRoot: {
            props: EMPTY_OBJECT as HTMLAttributes,
            id: id.value,
            selectionMode: selectionMode.value,
            disabled: disabled.value,
            readOnly: readOnly.value,
            isItemEqualToValue: isItemEqualToValue.value,
          },
          listElement: null,
          popupElementId: undefined,
          triggerElement: null,
          inputElement: null,
          inputGroupElement: null,
          popupSide: null,
          openMethod: null,
          inputInsidePopup: true,
          // Avoid duplicate names in the server HTML. Popup inputs aren't rendered
          // until after hydration, so the hidden input takes over then if needed.
          inputOwnsFormValue: selectionMode.value === 'none',
          instantType: undefined,
          adaptiveOrigin: undefined,
        },
        {
          ...createPopupStoreContext(),
          handleUnmount: NOOP,
          setInputValue: NOOP,
          setSelectedValue: NOOP,
          setIndices: NOOP,
          handleSelection: NOOP,
          forceMount: NOOP,
          requestSubmit: NOOP,
          listRef,
          labelsRef,
          emptyRef,
          inputRef,
          startDismissRef: shallowRef(null),
          endDismissRef: shallowRef(null),
          chipsContainerRef,
          clearRef,
          valuesRef,
          pointerDownItemRef,
          selectionEventRef,
          labelId,
          registerLabelId,
        },
        selectors,
      ),
    {
      name: 'Combobox',
      onOpenChange: (nextOpen, eventDetails) => handleOpenChange(nextOpen, eventDetails),
      onOpenChangeComplete: (nextOpen) => callbacks.onOpenChangeComplete(nextOpen),
      popupRef: animatedPopup,
    },
  );
  // A function of `setup` reads the current props, so the root assigns each command one time. A
  // part that renders in the same pass as the root then calls the real command.
  store.context.handleUnmount = handleUnmount;
  store.context.setInputValue = setInputValue;
  store.context.setSelectedValue = setSelectedValue;
  store.context.setIndices = setIndices;
  store.context.handleSelection = handleSelection;
  store.context.forceMount = forceMount;
  store.context.requestSubmit = requestSubmit;
  const popupRef = store.context.popupRef;

  const isGrouped = computed(() => isGroupedItems(items.value as any));
  const query = computed(() =>
    !open.value && closeQuery.value !== null ? closeQuery.value : String(inputValue.value).trim(),
  );
  const selectedLabelString = computed(() =>
    single.value ? stringifyValueLabel(selectedValue.value) : '',
  );
  const shouldBypassFiltering = computed(
    () =>
      single.value &&
      !queryChangedAfterOpen.value &&
      query.value !== '' &&
      selectedLabelString.value.length === query.value.length &&
      collatorFilter.value.contains(selectedLabelString.value, query.value),
  );
  const filterQuery = computed(() =>
    shouldBypassFiltering.value ? '' : (props.filterQuery ?? query.value),
  );
  const shouldIgnoreExternalFiltering = computed(
    () =>
      hasItems.value &&
      hasFilteredItemsProp.value &&
      shouldBypassFiltering.value &&
      (!collection.value ||
        collection.value.hasValue(selectedValue.value, isItemEqualToValue.value)),
  );

  const flatItems = computed<readonly Item[]>(() =>
    items.value ? flattenLeafItems<Item>(items.value as readonly Item[]) : EMPTY_ARRAY,
  );

  const filteredItems = computed<Item[] | Group<Item>[]>(() => {
    const filteredItemsProp = props.filteredItems;
    if (filteredItemsProp && !shouldIgnoreExternalFiltering.value) {
      return filteredItemsProp as Item[] | Group<Item>[];
    }
    const currentItems = items.value;
    if (!currentItems) {
      return EMPTY_ARRAY as Item[];
    }
    const currentLimit = limit.value;
    const currentQuery = filterQuery.value;
    const matches = filter.value;
    const toString = filterItemToString.value;

    if (isGrouped.value) {
      const resultingGroups: Group<Item>[] = [];
      let currentCount = 0;
      for (const group of currentItems as readonly Group<Item>[]) {
        if (currentLimit > -1 && currentCount >= currentLimit) {
          break;
        }
        const remainingLimit = currentLimit > -1 ? currentLimit - currentCount : Infinity;
        const itemsToTake = currentQuery === '' ? group.items.slice(0, remainingLimit) : [];
        if (currentQuery !== '') {
          for (const item of group.items) {
            if (itemsToTake.length >= remainingLimit) {
              break;
            }
            if (matches(item, currentQuery, toString)) {
              itemsToTake.push(item);
            }
          }
        }
        if (itemsToTake.length > 0) {
          resultingGroups.push({ ...group, items: itemsToTake });
          currentCount += itemsToTake.length;
        }
      }
      return resultingGroups;
    }

    if (currentQuery === '') {
      return currentLimit > -1
        ? flatItems.value.slice(0, currentLimit)
        : // The cast here is done as `flatItems` is readonly.
          // `valuesRef`, a mutable ref, can be set to `flatFilteredValues`, which may
          // reference this exact readonly value, creating a mutation risk.
          // However, <Combobox.Item> can never mutate this value as the mutating effect
          // bails early when `items` is provided, and this is only ever returned
          // when `items` is provided due to the early return at the top of this `computed`.
          (flatItems.value as Item[]);
    }
    const limitedItems: Item[] = [];
    for (const item of flatItems.value) {
      if (currentLimit > -1 && limitedItems.length >= currentLimit) {
        break;
      }
      if (matches(item, currentQuery, toString)) {
        limitedItems.push(item);
      }
    }
    return limitedItems;
  });

  /**
   * The filtered items flattened across groups and projected to their selection values.
   */
  const flatFilteredValues = computed<any[]>(() => {
    const currentWindow = externalWindow.value;
    if (currentWindow && filteredItems.value === props.filteredItems) {
      return currentWindow.values;
    }
    const flat = flattenLeafItems<Item>(filteredItems.value as readonly Item[]);
    const toValue = itemToValue.value;
    return toValue ? flat.map((item) => toValue(item)) : (flat as any[]);
  });

  // An inline list open on the first render never gets a closed pass of the closed-state
  // sync effect below, and `items`-prop lists don't self-register their index the way
  // individually rendered `<Combobox.Item>`s do, so the selected item was never highlighted.
  // Seeding the index here lets list navigation highlight and scroll to the selection on
  // mount. Computed once, so a selection or list that resolves after mount doesn't move an
  // existing highlight or scroll the list away.
  if (inlineProp.value && open.value && hasItems.value && selectionMode.value !== 'none') {
    store.set(
      'selectedIndex',
      findSelectionIndex(
        flatFilteredValues.value,
        selectedValue.value,
        isItemEqualToValue.value,
        multiple.value,
      ),
    );
  }

  const fieldRawValue = computed(() =>
    selectionMode.value === 'none' ? inputValue.value : selectedValue.value,
  );
  const fieldStringValue = computed(() => {
    if (selectionMode.value === 'none') {
      return fieldRawValue.value;
    }
    const value = selectedValue.value;
    if (Array.isArray(value)) {
      return value.map((current) => stringifyAsValue(current, props.itemToStringValue));
    }
    return stringifyAsValue(value, props.itemToStringValue);
  });

  const inline = computed(() => store.select('inline'));
  const inputInsidePopup = computed(() => store.select('inputInsidePopup'));
  const inputMatchesSelectedValue = computed(
    () => single.value && !inputInsidePopup.value && inputValue.value === selectedLabelString.value,
  );

  const { openMethod, triggerProps } = useOpenInteractionType(open);
  const isHydrating = useIsHydrating();

  useRegisterFieldControl(
    computed(() => (inputInsidePopup.value ? store.select('triggerElement') : inputRef.value)),
    id,
    () => fieldRawValue.value,
    () => fieldStringValue.value,
    () => !disabled.value,
    () => props.name,
  );

  // A handler of Base UI reads the query of the last render. A selection writes the input value
  // and then closes the popup in one task, and the close must keep the query that the list shows.
  let lastFlushQuery = query.value;
  watch(query, (next) => {
    lastFlushQuery = next;
  });

  function forceMount() {
    if (items.value) {
      // Ensure typeahead works on a closed list.
      labelsRef.value = flatFilteredValues.value.map(stringifyValueLabel);
    } else {
      store.set('forceMounted', true);
    }
  }

  /**
   * Emits `itemHighlighted` for the item at `index`, or clears the highlight when `index` is `-1`
   * (a no-op if nothing was highlighted). Keeps `lastHighlight` in sync with what was emitted.
   */
  function emitHighlight(
    value: any,
    index: number,
    type: AriaCombobox.HighlightEventReason,
    event?: Event,
  ) {
    if (index === -1) {
      if (lastHighlight === INITIAL_LAST_HIGHLIGHT) {
        return;
      }
      lastHighlight = INITIAL_LAST_HIGHLIGHT;
    } else {
      lastHighlight = { value, index };
    }
    callbacks.onItemHighlighted(value, createGenericEventDetails(type, event, { index }));
  }

  function setIndices(options: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
    event?: Event | undefined;
  }) {
    const update = {} as Pick<StoreState, 'activeIndex' | 'selectedIndex'>;
    if (options.activeIndex !== undefined) {
      update.activeIndex = options.activeIndex;
    }
    if (options.selectedIndex !== undefined) {
      update.selectedIndex = options.selectedIndex;
    }
    store.update(update);

    const activeIndexOption = options.activeIndex;
    if (activeIndexOption === undefined) {
      return;
    }
    const type: AriaCombobox.HighlightEventReason = options.type || REASONS.none;
    if (activeIndexOption === null) {
      emitHighlight(undefined, -1, type, options.event);
    } else {
      emitHighlight(valuesRef.value[activeIndexOption], activeIndexOption, type, options.event);
    }
  }

  function setInputValue(next: string, eventDetails: AriaCombobox.ChangeEventDetails) {
    callbacks.onInputValueChange(next, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }

    // A canceled selection clear must not suppress close-completion cleanup.
    hadInputClear = eventDetails.reason === REASONS.inputClear;
    const state = toRaw(store.state);

    // If user is typing, ensure we don't auto-highlight on open due to a race
    // with the post-open effect that sets this flag.
    if (eventDetails.reason === REASONS.inputChange) {
      // A controlled popup may ignore a close request. Resuming input proves the popup
      // is remaining open, so release the query captured for an exit animation.
      if (open.value && closeQuery.value !== null) {
        closeQuery.value = null;
      }
      const event = eventDetails.event as Event;
      const inputType = (event as InputEvent).inputType;
      // Treat composition commits as typed input; autofill may omit `inputType` or
      // report `insertReplacementText`.
      const isTypedInput =
        event.type === 'compositionend' ||
        (inputType != null && inputType !== '' && inputType !== 'insertReplacementText');
      if (isTypedInput) {
        const hasQuery = next.trim() !== '';
        if (hasQuery) {
          queryChangedAfterOpen.value = true;
        }
        // Defer index updates until after the filtered items have been derived to ensure
        // `itemHighlighted` receives the latest item.
        pendingQueryHighlight = { hasQuery };

        // Virtualized lists own their scroller. Reset regular lists directly so a stale
        // composite registry cannot select a reordered item and scrolling cannot escape
        // the popup.
        const list = state.listElement;
        if (!state.virtualized && list) {
          const popup = popupRef.value;
          for (const ancestor of getOverflowAncestors(list.firstElementChild ?? list)) {
            if (
              !isHTMLElement(ancestor) ||
              (popup ? !contains(popup, ancestor) : ancestor.getAttribute('role') === 'dialog')
            ) {
              break;
            }
            if (isScrollableY(ancestor)) {
              ancestor.scrollTop = 0;
              break;
            }
          }
        }

        if (
          hasQuery &&
          autoHighlightMode.value &&
          state.activeIndex == null &&
          (open.value || state.inline)
        ) {
          store.set('activeIndex', 0);
        }
      }
    } else if (
      eventDetails.reason === REASONS.inputClear &&
      next === '' &&
      state.inputInsidePopup
    ) {
      // A programmatic clear of an active query (e.g. after selecting an item with the
      // input inside the popup): restore the highlight to the selected item.
      pendingQueryHighlight = { hasQuery: false, selection: true };
    }

    setInputValueUnwrapped(next);
  }

  function handleInterruptedReopen(isInputChange: boolean) {
    const state = toRaw(store.state);
    // Preserve values supplied with the reopen rather than owned by the interrupted close.
    const clearsPendingInput =
      !isInputChange &&
      state.inputInsidePopup &&
      !state.inline &&
      inputValue.value !== '' &&
      (String(inputValue.value).trim() === closeQuery.value ||
        inputValue.value === selectedLabelString.value);

    // Keep the flag while a visible filter survives so the `items` sync cannot overwrite it.
    if (
      !isInputChange &&
      (clearsPendingInput || inputValue.value === '' || inputMatchesSelectedValue.value)
    ) {
      queryChangedAfterOpen.value = false;
    }
    closeQuery.value = null;
    if (clearsPendingInput) {
      // Cleanup clears omit the selection flag and reopening gesture.
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }
  }

  // Calls `onOpenChange` for every open change that isn't ignored, with the combobox's own handling
  // around it, before the store commits the change.
  function handleOpenChange(nextOpen: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) {
    // If the `Empty` component is not used, the positioner or popup should be hidden
    // with CSS. In this case, allow the Escape key to bubble to close a parent popup
    // if there are no items to show.
    if (
      eventDetails.reason === REASONS.escapeKey &&
      hasItems.value &&
      flatFilteredValues.value.length === 0 &&
      !emptyRef.value
    ) {
      eventDetails.allowPropagation();
    }

    callbacks.onOpenChange(nextOpen, eventDetails);

    // A typed request must not highlight a later open: discard it when its own open is
    // rejected, or when any other open change goes through.
    if (
      pendingQueryHighlight?.hasQuery &&
      (eventDetails.reason === REASONS.inputChange) === eventDetails.isCanceled
    ) {
      pendingQueryHighlight = null;
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen && closeQuery.value !== null) {
      // `ComboboxInput` calls `setInputValue` before `setOpen`. An input-change reopen thus comes
      // with typed text: it clears no input, and the typed filter always survives.
      handleInterruptedReopen(eventDetails.reason === REASONS.inputChange);
    }

    const state = toRaw(store.state);
    if (!nextOpen && queryChangedAfterOpen.value) {
      if (single.value) {
        if (!state.inline) {
          closeQuery.value = lastFlushQuery;
        }
        // Avoid a flicker when closing the popup with an empty query.
        if (lastFlushQuery === '') {
          queryChangedAfterOpen.value = false;
        }
      } else if (multiple.value) {
        if (!state.inline) {
          // Freeze the current query so filtering remains stable while exiting.
          closeQuery.value = lastFlushQuery;
        }
        if (state.inputInsidePopup) {
          setIndices({ activeIndex: null });
        }
        // Clear the input immediately on close while retaining filtering via closeQuery for exit animations
        // if the input is outside the popup. When the input is inside the popup, defer the clear until
        // unmount so the filtered list doesn't flash to unfiltered during the exit animation.
        if (!state.inputInsidePopup || state.inline) {
          setInputValue(
            '',
            createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
              isItemPress: eventDetails.reason === REASONS.itemPress,
            }),
          );
        }
      }
    }

    if (
      !nextOpen &&
      state.inputInsidePopup &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      setTouched(true);
      setFocused(false);
      // A combobox that the user leaves with no value is not marked dirty. With a selection mode,
      // the trigger is a select, so the field counts `valueMissing` with no mark (BUG-1425).
      if (validationMode.value === 'onBlur') {
        const selectsValues = selectionMode.value !== 'none';
        void validation.commit(
          selectsValues ? selectedValue.value : inputValue.value,
          selectsValues,
        );
      }
    }
  }

  function setSelectedValue(nextValue: any, eventDetails: AriaCombobox.ChangeEventDetails) {
    callbacks.onSelectedValueChange(nextValue, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    setSelectedValueUnwrapped(nextValue);

    const shouldFillInput =
      (selectionMode.value === 'none' && popupRef.value && (props.fillInputOnItemPress ?? true)) ||
      (single.value && !toRaw(store.state).inputInsidePopup);
    if (shouldFillInput) {
      setInputValue(
        stringifyValueLabel(nextValue),
        createChangeEventDetails(eventDetails.reason, eventDetails.event),
      );
    }
  }

  function handleSelection(event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) {
    const targetEl = getTarget(event) as HTMLElement | null;
    const overrideEvent = selectionEventRef.value ?? event;
    selectionEventRef.value = null;
    const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);

    // Let the link handle the click.
    const href = closest(targetEl, 'a')?.getAttribute('href');
    if (href) {
      if (href.startsWith('#')) {
        store.setOpen(false, eventDetails);
      }
      return;
    }

    if (multiple.value) {
      const current = Array.isArray(selectedValue.value) ? selectedValue.value : [];
      const isCurrentlySelected = selectedValueIncludes(
        current,
        itemValue,
        isItemEqualToValue.value,
      );
      const nextValue = isCurrentlySelected
        ? removeItem(current, itemValue, isItemEqualToValue.value)
        : [...current, itemValue];
      setSelectedValue(nextValue, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      const wasFiltering = inputRef.value ? inputRef.value.value.trim() !== '' : false;
      if (!wasFiltering) {
        return;
      }
      if (toRaw(store.state).inputInsidePopup) {
        setInputValue(
          '',
          createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
            isItemPress: true,
          }),
        );
        // A newly selected item stays highlighted through the clear; a deselection
        // falls back to the standard selection anchor.
        if (pendingQueryHighlight && !isCurrentlySelected) {
          pendingQueryHighlight.toggledValue = itemValue;
        }
      } else {
        store.setOpen(false, eventDetails);
      }
    } else {
      setSelectedValue(itemValue, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      store.setOpen(false, eventDetails);
    }
  }

  function requestSubmit() {
    // Not `validation.inputRef`: outside a Field, every control shares it.
    const formElement = hiddenInputElement.value?.form ?? toRaw(store.state).inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function handleUnmount() {
    queryChangedAfterOpen.value = false;
    closeQuery.value = null;

    if (selectionMode.value === 'none') {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }

    const input = inputRef.value;
    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (multiple.value && input && input.value !== '' && !hadInputClear) {
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }

    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (single.value) {
      if (toRaw(store.state).inputInsidePopup) {
        if (input && input.value !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyValueLabel(selectedValue.value);
        if (input && input.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === '' ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  }

  // Support composing the Dialog component around an inline combobox.
  // `[role="dialog"]` is more interoperable than using a context, e.g. it can work
  // with third-party modal libraries, though the limitation is that the closest
  // `role=dialog` part must be the animated element.
  function getResolvedPopup() {
    const positioner = toRaw(store.state).positionerElement;
    return inline.value && positioner
      ? (closest(positioner, '[role="dialog"]') as HTMLElement | null)
      : popupRef.value;
  }
  function syncAnimatedPopup() {
    animatedPopup.value = getResolvedPopup();
  }
  onMounted(syncAnimatedPopup);
  watch([inline, () => store.select('positionerElement'), popupRef], syncAnimatedPopup, {
    flush: 'post',
  });

  // The blocks below are the layout effects of Base UI, in the sequence of its source.
  function syncSelectedIndex() {
    const closeQueryReleased = previousCloseQuery !== null && closeQuery.value === null;
    previousCloseQuery = closeQuery.value;

    // Closing indexes against the frozen filtered list. Reopening releases that query, so its
    // rendered coordinates must be synchronized again even though the popup is already open.
    if (open.value && (!closeQueryReleased || !hasItems.value)) {
      return;
    }

    // State-driven (not tied to the internal event path) so controlled closes
    // also clear a pointerdown that never received a matching item mouseup.
    if (!open.value) {
      pointerDownItemRef.value = null;
    }

    if (selectionMode.value === 'none') {
      return;
    }

    // Without `items`, look the selection up in the live registry of mounted item
    // values (the list stays mounted while closed when closed-state features need
    // it — trigger interaction and rendered-label autofill force-mount it). Mounted
    // items re-assert the index themselves when their registration moves; when
    // nothing is mounted the lookup resolves to `null` and each item re-registers
    // the index on the next open.
    // Keep the selected index in the coordinates of the list that is actually rendered.
    const registry: readonly any[] = hasItems.value ? flatFilteredValues.value : valuesRef.value;
    setIndices({
      selectedIndex: findSelectionIndex(
        registry,
        selectedValue.value,
        isItemEqualToValue.value,
        multiple.value,
      ),
    });
  }

  // An item part reads `valuesRef` when it renders, so this copy has the default flush. It runs
  // before the render of the parts.
  function syncValuesRef() {
    if (items.value) {
      valuesRef.value = flatFilteredValues.value;
      listRef.value.length = flatFilteredValues.value.length;
    }
  }

  function dropPendingHighlightOnClose() {
    // Controlled closes can bypass `setOpen`, and their exit animation may be interrupted.
    if (!open.value && pendingQueryHighlight?.hasQuery) {
      pendingQueryHighlight = null;
    }
  }

  function syncHighlight() {
    // A kept-mounted dialog hides its inline list on close. Discard query-clear restoration
    // before it can overwrite the cleared highlight or report an item from the unfiltered list.
    if (!open.value && inline.value && getResolvedPopup()) {
      pendingQueryHighlight = null;
      return;
    }

    const state = toRaw(store.state);
    const candidateItems =
      hasItems.value || hasFilteredItemsProp.value ? flatFilteredValues.value : valuesRef.value;
    const pendingHighlight = pendingQueryHighlight;
    if (pendingHighlight) {
      // A directly rendered list remains visible when the popup state is closed, while a
      // kept-mounted Positioner is hidden and should stay inert.
      const listIsNavigable =
        open.value || inline.value || state.positionerElement?.hidden === false;
      if (pendingHighlight.hasQuery) {
        const input = inputRef.value;
        // Keep the request while results or a controlled popup opening are pending,
        // but do not restore an inline highlight after focus has left the input.
        if (
          !autoHighlightMode.value ||
          String(inputValue.value).trim() === '' ||
          (inline.value &&
            autoHighlightMode.value !== 'always' &&
            (!input || activeElement(input.ownerDocument) !== input))
        ) {
          pendingQueryHighlight = null;
        } else if (
          listIsNavigable &&
          // Individually rendered items register without re-running this effect, and their
          // registry has holes mid-reindex, so resolve their request immediately.
          (candidateItems[0] !== undefined || (!hasItems.value && !hasFilteredItemsProp.value))
        ) {
          store.set('activeIndex', 0);
          pendingQueryHighlight = null;
        }
      } else if (String(inputValue.value).trim() === '') {
        // Only handle the clear once it has committed (a controlled input may reject it),
        // so a restore cannot fire while a query is still active.
        pendingQueryHighlight = null;
        if (listIsNavigable) {
          const clearedBySelection = pendingHighlight.selection;
          if (
            autoHighlightMode.value === 'always' &&
            !clearedBySelection &&
            state.selectionMode === 'none'
          ) {
            // There is no selection to restore in Autocomplete. Keep the first-item reset
            // synchronous so list navigation sees it before a directly rendered list closes.
            store.set('activeIndex', 0);
          }

          // Items re-mounted by the clear publish their composite indices in a follow-up
          // commit, so the item registries are mid-update here.
          queueMicrotask(() => {
            const current = toRaw(store.state);
            if (
              (!current.open && (!current.inline || getResolvedPopup())) ||
              (inputRef.value && inputRef.value.value.trim() !== '')
            ) {
              return;
            }

            // Return the highlight to the selected item, the same anchor the popup uses
            // when it first opens.
            const currentSelectedValue = current.selectedValue;
            const isMultiple = current.selectionMode === 'multiple';
            const hasSelection =
              isMultiple && Array.isArray(currentSelectedValue)
                ? currentSelectedValue.length > 0
                : current.selectionMode !== 'none' && currentSelectedValue != null;

            if (hasSelection) {
              const registry =
                hasItems.value || hasFilteredItemsProp.value
                  ? flatFilteredValues.value
                  : valuesRef.value;
              // A selection-driven clear keeps the just-selected item highlighted;
              // otherwise return to the open anchor. A selection that is no longer in
              // the list drops the highlight rather than leaving it on whichever item
              // now occupies that index.
              // `findItemIndex` resolves to -1 when no value was toggled.
              const toggledIndex = findItemIndex(
                registry,
                pendingHighlight.toggledValue,
                current.isItemEqualToValue,
              );
              store.set(
                'activeIndex',
                toggledIndex !== -1
                  ? toggledIndex
                  : findSelectionIndex(
                      registry,
                      currentSelectedValue,
                      current.isItemEqualToValue,
                      isMultiple,
                    ),
              );
            } else if (clearedBySelection) {
              store.set('activeIndex', null);
            } else if (autoHighlightMode.value === 'always') {
              store.set('activeIndex', 0);
            }
          });
        }
      }
    }

    if (!open.value && !inline.value) {
      return;
    }

    const storeActiveIndex = state.activeIndex;

    if (storeActiveIndex == null) {
      if (autoHighlightMode.value === 'always' && candidateItems.length > 0) {
        store.set('activeIndex', 0);
        return;
      }
      emitHighlight(undefined, -1, REASONS.none);
      return;
    }

    if (storeActiveIndex >= candidateItems.length) {
      emitHighlight(undefined, -1, REASONS.none);
      store.set('activeIndex', null);
      return;
    }

    const itemValue = candidateItems[storeActiveIndex];
    const previouslyHighlightedItemValue = lastHighlight.value;
    const isSameItem =
      previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
      compareItemEquality(itemValue, previouslyHighlightedItemValue, state.isItemEqualToValue);

    if (lastHighlight.index !== storeActiveIndex || !isSameItem) {
      emitHighlight(itemValue, storeActiveIndex, REASONS.none);
    }
  }

  const activeIndex = computed(() => store.select('activeIndex'));
  const selectedIndex = computed(() => store.select('selectedIndex'));

  // The dependencies of each block, from its last run.
  const lastHighlightDependencies = new Map<string, ReadonlyArray<unknown>>();
  function haveChanged(block: string, dependencies: ReadonlyArray<unknown>) {
    const last = lastHighlightDependencies.get(block);
    lastHighlightDependencies.set(block, dependencies);
    return !last || dependencies.some((dependency, i) => !Object.is(dependency, last[i]));
  }

  function readHighlightDependencies() {
    return {
      selectedIndex: [
        open.value,
        closeQuery.value,
        selectedValue.value,
        selectionMode.value,
        hasItems.value,
        flatFilteredValues.value,
        isItemEqualToValue.value,
      ],
      pendingHighlight: [open.value],
      highlight: [
        activeIndex.value,
        autoHighlightMode.value,
        hasFilteredItemsProp.value,
        hasItems.value,
        flatFilteredValues.value,
        inline.value,
        open.value,
        // The resolved popup of an inline list is the dialog around its positioner.
        inline.value ? store.select('positionerElement') : null,
        // Reruns the effect when the query changes without affecting the deps above, such as
        // clearing the input when no items are filtered out (individually rendered items).
        inputValue.value,
      ],
    };
  }

  // One watcher runs the three blocks, and each block runs when one of its dependencies changed. A
  // flush that changes the dependencies of two blocks then runs them in the sequence of Base UI. A
  // watcher for each block runs in the sequence of the writes: a controlled close in the flush of
  // a typed query would then highlight an item of the closing popup.
  function syncHighlightBlocks(dependencies = readHighlightDependencies()) {
    if (haveChanged('selectedIndex', dependencies.selectedIndex)) {
      syncSelectedIndex();
    }
    if (haveChanged('pendingHighlight', dependencies.pendingHighlight)) {
      dropPendingHighlightOnClose();
    }
    if (haveChanged('highlight', dependencies.highlight)) {
      syncHighlight();
    }
  }

  onMounted(() => syncHighlightBlocks());
  watch(readHighlightDependencies, syncHighlightBlocks, { flush: 'post' });
  syncValuesRef();
  watch([items, flatFilteredValues], syncValuesRef);

  const filled = computed(() => {
    if (selectionMode.value === 'none') {
      return String(inputValue.value) !== '';
    }
    const value = selectedValue.value;
    return multiple.value ? Array.isArray(value) && value.length > 0 : value != null;
  });
  setFilled(filled.value);
  watch(filled, setFilled);

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  watch(
    [hasItems, autoHighlightMode, () => flatFilteredValues.value.length],
    () => {
      if (hasItems.value && autoHighlightMode.value && flatFilteredValues.value.length === 0) {
        setIndices({ activeIndex: null });
      }
    },
    { flush: 'post' },
  );

  // The change of a reset reaches `useValueChanged` after the reset timeout. The timeout sets this
  // flag, and the callback clears the field and starts no validation.
  let isResetChangePending = false;

  // These sync triggers can run in the same commit while still seeing the pre-commit `inputValue`.
  // This flag prevents duplicate callbacks and resets so canceled writes can retry. The callbacks
  // of one flush stand for one commit, so `nextTick` clears the flag.
  let syncedSelectedLabel = false;
  function syncInputToSelectedLabel() {
    if (!syncedSelectedLabel && inputValue.value !== selectedLabelString.value) {
      syncedSelectedLabel = true;
      void nextTick(() => {
        syncedSelectedLabel = false;
      });
      setInputValue(selectedLabelString.value, createChangeEventDetails(REASONS.none));
    }
  }

  // The label catches accessor changes while the items identity restores the selected label after
  // a one-step input clear followed by a data reload. The shared sync prevents duplicate writes
  // when both change in the same commit.
  function syncInputAfterItemsOrLabelChange() {
    if (
      single.value &&
      !hasInputValue.value &&
      !inputInsidePopup.value &&
      !queryChangedAfterOpen.value
    ) {
      syncInputToSelectedLabel();
    }
  }

  useValueChanged(query, () => {
    if (
      open.value &&
      query.value !== '' &&
      query.value !== String(initialDefaultInputValue) &&
      !inputMatchesSelectedValue.value
    ) {
      queryChangedAfterOpen.value = true;
    }
  });
  useValueChanged(open, () => {
    // A controlled `open` prop can interrupt the close without calling `setOpen`.
    if (open.value && closeQuery.value !== null) {
      handleInterruptedReopen(false);
    }
  });
  useValueChanged(selectedValue, () => {
    if (selectionMode.value === 'none') {
      return;
    }
    clearErrors(name.value);
    setDirty(
      isSelectedValueDirty(
        selectedValue.value,
        validityData.value.initialValue,
        isItemEqualToValue.value,
      ),
    );
    if (isResetChangePending) {
      isResetChangePending = false;
      clearFieldError(selectedValue.value);
    } else {
      void validation.change(selectedValue.value);
    }
    if (single.value && !hasInputValue.value && !inputInsidePopup.value) {
      syncInputToSelectedLabel();
    }
  });
  useValueChanged(selectedLabelString, syncInputAfterItemsOrLabelChange);
  useValueChanged(items, syncInputAfterItemsOrLabelChange);
  useValueChanged(inputValue, () => {
    if (selectionMode.value !== 'none') {
      return;
    }
    clearErrors(name.value);
    setDirty(inputValue.value !== validityData.value.initialValue);
    if (isResetChangePending) {
      isResetChangePending = false;
      clearFieldError(inputValue.value);
    } else {
      void validation.change(inputValue.value);
    }
  });

  // An inline list is permanently expanded (see `ComboboxStore.interactions`).
  const expanded = computed(() => open.value || inline.value);
  const inputElement = computed(() => store.select('inputElement'));
  const listElementId = computed(() => store.select('listElement')?.id);

  const role = computed(() => {
    const isPlainInput = inputElement.value?.tagName === 'INPUT';
    // During SSR and initial hydration, the input ref is not available yet.
    // Assume an input-like control so combobox ARIA attributes are present.
    const shouldTreatAsInput = inputElement.value == null || isPlainInput;
    // A non-input control only takes on combobox semantics while the list is exposed, which for
    // an inline list is the whole time.
    const shouldApplyAria = shouldTreatAsInput || expanded.value;
    // Vue before 3.5.14 sets the key `autocorrect` as a Boolean DOM property. The key
    // `autoCorrect` is an attribute in each version.
    const reference: Record<string, unknown> = shouldTreatAsInput
      ? { autocomplete: 'off', spellcheck: 'false', autoCorrect: 'off', autocapitalize: 'none' }
      : {};
    if (shouldApplyAria) {
      reference.role = 'combobox';
      reference['aria-expanded'] = expanded.value ? 'true' : 'false';
      reference['aria-haspopup'] = grid.value ? 'grid' : 'listbox';
      reference['aria-controls'] = expanded.value ? listElementId.value : undefined;
      // `readOnly` accepts no input, so no completion of any kind is offered.
      reference['aria-autocomplete'] = readOnly.value ? 'none' : (props.autoComplete ?? 'list');
    }
    return reference as HTMLAttributes;
  });

  // `readOnly` locks the value, not the interaction: the popup opens and can be browsed.
  // Value changes stay blocked in `ComboboxItem`, `ComboboxInput`'s keydown, `ComboboxTrigger`'s
  // typeahead, the clear/remove parts, and the hidden input's autofill handler.
  const click = useClick(store.interactions, {
    enabled: () => !disabled.value && (props.openOnInputClick ?? true),
    event: 'mousedown-only',
    toggle: false,
    // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
    // This avoids top-bottom flip flickers if the preferred position is "top" when first tapping.
    touchOpenDelay: () => (inputInsidePopup.value ? 0 : 100),
    reason: REASONS.inputPress,
  });

  const dismiss = useDismiss(store.interactions, {
    enabled: () => !disabled.value && !inline.value,
    outsidePressEvent: {
      mouse: 'sloppy',
      // The visual viewport (affected by the mobile software keyboard) can be
      // somewhat small. The user may want to scroll the screen to see more of
      // the popup.
      touch: 'intentional',
    },
    // Without a popup, let the Escape key bubble the event up to other popups' handlers.
    bubbles: () => (inline.value ? true : undefined),
    outsidePress(event) {
      const target = getTarget(event) as Element | null;
      const state = toRaw(store.state);
      return (
        !contains(state.triggerElement, target) &&
        !contains(clearRef.value, target) &&
        !contains(chipsContainerRef.value, target) &&
        !contains(state.inputGroupElement, target)
      );
    },
  });

  const listNavigation = useListNavigation(store.interactions, {
    enabled: () => !disabled.value,
    id,
    listRef,
    activeIndex,
    selectedIndex,
    virtual: true,
    loopFocus: () => props.loopFocus ?? true,
    allowEscape: () => (props.loopFocus ?? true) && !autoHighlightMode.value,
    focusItemOnOpen: () =>
      queryChangedAfterOpen.value || (selectionMode.value === 'none' && !autoHighlightMode.value)
        ? false
        : 'auto',
    focusItemOnHover: () => props.highlightItemOnHover ?? true,
    resetOnPointerLeave: () => !(props.keepHighlight ?? false),
    orientation: () => (grid.value ? 'horizontal' : undefined),
    rtl: () => direction.value === 'rtl',
    disabledIndices: EMPTY_ARRAY as number[],
    grid: () => (grid.value ? gridNavigation : undefined),
    onNavigate(nextActiveIndex, event) {
      // Ignore automatic navigation while closed, including selected-index sync for inline lists.
      // Inline lists remain navigable while `open` is false, so still allow resets (clearing the
      // highlight when an unbound inline list unmounts, e.g. in a closed dialog).
      if (
        (!event && !open.value && !(inline.value && nextActiveIndex === null)) ||
        transitionStatus.value === 'ending'
      ) {
        return;
      }
      setIndices({ activeIndex: nextActiveIndex, type: getHighlightReason(event), event });
    },
  });

  const inputProps = computed(() =>
    mergeProps(
      listNavigation.value.reference,
      {
        onKeydown(event: VaseUIEvent<KeyboardEvent>) {
          // In grid mode the navigation hook treats ArrowLeft/ArrowRight as horizontal
          // grid movement. When the input has focus and no item is highlighted the user
          // is still editing the query, so let the input keep its native caret behavior.
          if (
            grid.value &&
            toRaw(store.state).activeIndex == null &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
          ) {
            event.preventVaseUIHandler();
          }
        },
      },
      dismiss.reference,
      click.reference,
      role.value,
    ),
  );
  const popupProps = mergeProps(FOCUSABLE_POPUP_PROPS, dismiss.floating);
  const listProps = computed(() =>
    mergeProps(listNavigation.value.floating, { role: 'presentation' }),
  );
  const itemRoot = computed(() => {
    // Combobox keeps focus on the input; item focus would incorrectly sync
    // list navigation state from DOM focus.
    const { onFocusin: _onFocusin, ...itemProps } = listNavigation.value.item;
    return {
      props: itemProps as HTMLAttributes,
      id: id.value,
      selectionMode: selectionMode.value,
      disabled: disabled.value,
      readOnly: readOnly.value,
      isItemEqualToValue: isItemEqualToValue.value,
    };
  });

  // The call writes the state at once, so each part reads it in its first render. It then writes
  // one time for each flush in which a source changed.
  usePopupInteractionProps(store, () => ({
    id: id.value,
    labelId: labelId.value,
    selectedValue: selectedValue.value,
    items: storeItems.value as readonly any[] | undefined,
    inline: inlineProp.value,
    popupProps,
    listProps: listProps.value,
    inputProps: inputProps.value,
    activeTriggerProps: triggerProps as HTMLAttributes,
    inactiveTriggerProps: EMPTY_OBJECT as HTMLAttributes,
    itemRoot: itemRoot.value,
    openMethod: openMethod.value,
    selectionMode: selectionMode.value,
    name: name.value,
    form: props.form,
    disabled: disabled.value,
    readOnly: readOnly.value,
    required: required.value,
    grid: grid.value,
    virtualized: props.virtualized ?? false,
    openOnInputClick: props.openOnInputClick ?? true,
    itemToStringLabel: itemToStringLabel.value,
    modal: props.modal ?? false,
    autoHighlight: autoHighlightMode.value,
    isItemEqualToValue: isItemEqualToValue.value,
    submitOnItemClick: props.submitOnItemClick ?? false,
    hasInputValue: hasInputValue.value,
    // The input part writes `inputInsidePopup` in its `ref` callback. The getter reads that key, so
    // this key follows in the next write. Until the root is mounted, it keeps the value of the
    // first state, because a server calls no `ref` callback.
    inputOwnsFormValue:
      selectionMode.value === 'none' &&
      (isHydrating.value || inlineProp.value || !inputInsidePopup.value),
  }));

  provide(ComboboxRootContext, store);
  provide(ComboboxHasItemsContext, hasItems);
  provide(ComboboxDerivedItemsContext, {
    hasItems,
    filteredItems: filteredItems as ComputedRef<any[]>,
    flatFilteredValues,
  });
  provide(ComboboxInputValueContext, inputValue);

  const serializedValue = computed(() => {
    const raw = fieldRawValue.value;
    if (Array.isArray(raw)) {
      return '';
    }
    return stringifyAsValue(raw, props.itemToStringValue);
  });
  const hasMultipleSelection = computed(
    () => multiple.value && Array.isArray(selectedValue.value) && selectedValue.value.length > 0,
  );
  const inputOwnsFormValue = computed(() => store.select('inputOwnsFormValue'));
  const hiddenInputName = computed(() =>
    multiple.value || (selectionMode.value === 'none' && inputOwnsFormValue.value)
      ? undefined
      : name.value,
  );
  const hiddenValues = computed(() => {
    const value = selectedValue.value;
    if (!multiple.value || !Array.isArray(value) || !name.value) {
      return EMPTY_ARRAY as string[];
    }
    return value.map((current) => stringifyAsValue(current, props.itemToStringValue));
  });

  function setHiddenInputElement(value: unknown) {
    const input = value as HTMLInputElement | null;
    // Vue calls a function ref again on each patch, with the same element.
    if (input === hiddenInputElement.value) {
      return;
    }
    hiddenInputElement.value = input;
    validation.inputRef.value = input;
  }

  // Vue writes the value to the input only when the root renders. A browser can change the input
  // with no change of the state: an autofill, and the restore of the form state of a page.
  function writeValueToInput() {
    const input = hiddenInputElement.value;
    if (input && input.value !== serializedValue.value) {
      input.value = serializedValue.value;
    }
  }

  // Handle browser autofill.
  let lastHandledValue: string | undefined;
  function handleAutofill(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const nextValue = input.value;
    // A program can send `input` and `change` in one task. The root handles a value one time.
    if (nextValue === lastHandledValue || nextValue === serializedValue.value) {
      return;
    }
    lastHandledValue = nextValue;
    void nextTick(() => {
      lastHandledValue = undefined;
      writeValueToInput();
    });
    if (event.defaultPrevented || disabled.value || readOnly.value) {
      return;
    }

    const nextValueLower = nextValue.toLowerCase();
    const details = createChangeEventDetails(REASONS.none, event);

    const findSerializedMatchIndex = () =>
      valuesRef.value.findIndex(
        (candidate) =>
          stringifyAsValue(candidate, props.itemToStringValue).toLowerCase() === nextValueLower ||
          stringifyValueLabel(candidate).toLowerCase() === nextValueLower,
      );

    function handleChange() {
      // Browser autofill only writes a single scalar value.
      if (multiple.value) {
        return;
      }

      if (selectionMode.value === 'none') {
        setInputValue(nextValue, details);
        return;
      }

      // Preserve the original serialized matching, then fall back to rendered text,
      // which browsers can autofill for primitive values like `value="US">United States`.
      let matchingIndex = findSerializedMatchIndex();

      if (matchingIndex === -1) {
        matchingIndex = valuesRef.value.findIndex((_, index) => {
          const renderedLabel = labelsRef.value[index];
          return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
        });
      }

      const matchingValue = matchingIndex === -1 ? undefined : valuesRef.value[matchingIndex];
      if (matchingValue != null) {
        // `setSelectedValue` may be canceled by `valueChange`; rely on
        // `useValueChanged` to mark the field dirty and run validation only
        // when the value actually changes.
        setSelectedValue(matchingValue, details);
      }
    }

    // Only single-selection autofill matches against the registered values/labels.
    // `multiple` ignores autofill and `none` just writes the input value, so avoid the
    // sticky `forceMounted` mount (which never resets) for those modes.
    if (single.value) {
      forceMount();
      if (items.value && findSerializedMatchIndex() === -1) {
        // `forceMount` only refreshes the derived labels for the `items` prop. When
        // serialized matching misses, also mount the list so rendered labels (which can
        // differ from the serialized values) are registered for autofill matching.
        store.set('forceMounted', true);
      }
    }
    queueMicrotask(handleChange);
  }

  // The text of the input after a reset. An input inside the popup is empty while the popup is
  // closed, so it gets no label.
  function getDefaultInputValue(): string {
    if (hasInputValue.value) {
      return String(props.defaultInputValue ?? '');
    }
    if (single.value && !toRaw(store.state).inputInsidePopup) {
      return stringifyValueLabel(getDefaultSelectedValue());
    }
    return '';
  }

  useFormReset(hiddenInputElement, (event) => {
    let hasChanged = false;
    if (selectionMode.value !== 'none' && props.selectedValue === undefined) {
      const defaultValue = getDefaultSelectedValue();
      if (isSelectedValueDirty(selectedValue.value, defaultValue, isItemEqualToValue.value)) {
        const details = createChangeEventDetails(REASONS.none, event);
        setSelectedValue(defaultValue, details);
        hasChanged = !details.isCanceled;
      }
    }
    if (!(props.inputValueControlled ?? props.inputValue !== undefined)) {
      const defaultInputValue = getDefaultInputValue();
      if (inputValue.value !== defaultInputValue) {
        const details = createChangeEventDetails(REASONS.none, event);
        setInputValue(defaultInputValue, details);
        hasChanged ||= selectionMode.value === 'none' && !details.isCanceled;
      }
    }
    if (hasChanged) {
      isResetChangePending = true;
    } else {
      clearFieldError(fieldRawValue.value);
    }
  });

  // `KeepAlive` takes the hidden input out of the document. The flag is a source of the `watch`,
  // so its cleanup removes the listener of the window.
  const isDeactivated = shallowRef(false);
  onDeactivated(() => {
    isDeactivated.value = true;
  });
  onActivated(() => {
    isDeactivated.value = false;
  });
  watch(
    [hiddenInputElement, isDeactivated] as const,
    ([input, deactivated], _previous, onCleanup) => {
      if (!input || deactivated) {
        return;
      }
      // Chromium restores the form state of a page after `load`, with no event on the input.
      onCleanup(addEventListener(ownerWindow(input), 'pageshow', writeValueToInput));
    },
    { flush: 'post' },
  );

  // The style is the constant itself, in an object that no `mergeProps` call makes.
  // `handleHiddenInputInvalid` then keeps the size that it writes.
  function hiddenInputProps() {
    return {
      ...validation.getValidationProps(disabled.value),
      ref: setHiddenInputElement,
      id: id.value && hiddenInputName.value == null ? `${id.value}-hidden-input` : undefined,
      form: props.form,
      name: hiddenInputName.value,
      type: getHiddenInputType(
        setValidityData !== NOOP,
        name.value,
        props.formAutoComplete,
        required.value,
      ),
      autocomplete: props.formAutoComplete,
      disabled: disabled.value,
      required: required.value && !hasMultipleSelection.value,
      readonly: readOnly.value,
      value: serializedValue.value,
      style: hiddenInputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
      tabindex: -1,
      'aria-hidden': true,
      onInvalid: handleHiddenInputInvalid,
      // Move focus when the hidden input is focused.
      onFocusin() {
        const state = toRaw(store.state);
        if (state.inputInsidePopup) {
          state.triggerElement?.focus();
          return;
        }
        (inputRef.value || state.triggerElement)?.focus();
      },
      onInput: handleAutofill,
      onChange: handleAutofill,
    };
  }

  return {
    store,
    actions,
    inputElement: hiddenInputElement,
    hiddenInputProps,
    hiddenValues,
    name,
    disabled,
  };
}
