<script lang="ts">
import type {
  AriaCombobox,
  AriaComboboxProps,
  AriaComboboxState,
} from '../../combobox/root/AriaCombobox';
import type { ComboboxInputElementValue } from '../../combobox/root/ComboboxRootContext';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { Group } from '../../internals/resolveValueLabel';

export interface AutocompleteRootProps<ItemValue = any> extends Omit<
  AriaComboboxProps<ItemValue, 'none'>,
  | 'selectionMode'
  | 'selectedValue'
  | 'defaultSelectedValue'
  | 'fillInputOnItemPress'
  | 'itemToStringValue'
  | 'isItemEqualToValue'
  | 'inputValue'
  | 'defaultInputValue'
  | 'inputValueControlled'
  | 'filterQuery'
  | 'autoComplete'
  | 'formAutoComplete'
  | 'itemToStringLabel'
  | 'inline'
  | 'autoHighlight'
  | 'keepHighlight'
  | 'highlightItemOnHover'
  | 'openOnInputClick'
  | 'submitOnItemClick'
  | 'form'
  | 'items'
  | 'filteredItems'
  | 'filter'
> {
  /**
   * Identifies the form that owns the internal input.
   * Useful when the autocomplete is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The items to be displayed in the list.
   * Can be either a flat array of items or an array of groups with items.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?: readonly ItemValue[] | readonly Group<ItemValue>[] | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly ItemValue[] | readonly Group<ItemValue>[] | undefined;
  /**
   * Filter function used to match items against the input query.
   */
  filter?:
    | null
    | ((item: ItemValue, query: string, itemToString?: (item: ItemValue) => string) => boolean)
    | undefined;
  /**
   * Controls how the autocomplete behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  mode?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Autocomplete.Root inline open>`
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: always highlight the first item.
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
   * The uncontrolled input value of the autocomplete when it's initially rendered.
   *
   * To render a controlled autocomplete, use the `value` prop instead.
   */
  defaultValue?: ComboboxInputElementValue;
  /**
   * The input value of the autocomplete. Use when controlled.
   */
  value?: ComboboxInputElementValue;
  /**
   * Whether clicking an item should submit the autocomplete's owning form.
   * By default, clicking an item via a pointer or <kbd>Enter</kbd> key does not submit the owning form.
   * Useful when the autocomplete is used as a single-field form search input.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * When the item values are objects (`<Autocomplete.Item :value="object">`), this function converts the object value to a string representation for both display in the input and form submission.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default false
   */
  openOnInputClick?: boolean | undefined;
}

/**
 * The item type of an `items` list: the item of a group for a list of groups, else the item of
 * the list.
 */
export type AutocompleteItemValue<Items> = Items extends readonly {
  items: readonly (infer GroupItem)[];
}[]
  ? GroupItem
  : Items extends readonly (infer Item)[]
    ? Item
    : never;

export interface AutocompleteRootSetupProps<Items extends readonly any[]> extends Omit<
  AutocompleteRootProps<AutocompleteItemValue<Items>>,
  'items'
> {
  /**
   * The items to be displayed in the list.
   * Can be either a flat array of items or an array of groups with items.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?: Items | undefined;
}

export interface AutocompleteRootState extends AriaComboboxState {}

export type AutocompleteRootActions = AriaCombobox.Actions;

export type AutocompleteRootChangeEventReason = AriaCombobox.ChangeEventReason;
export type AutocompleteRootChangeEventDetails =
  VaseUIChangeEventDetails<AutocompleteRootChangeEventReason>;
export type AutocompleteRootOpenChangeEventDetails = AutocompleteRootChangeEventDetails & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type AutocompleteRootHighlightEventReason = AriaCombobox.HighlightEventReason;
export type AutocompleteRootHighlightEventDetails = AriaCombobox.HighlightEventDetails;
</script>

<script setup lang="ts" generic="Items extends readonly any[]">
import { computed, nextTick, shallowRef, watch } from 'vue';
import { useAriaCombobox } from '../../combobox/root/AriaCombobox';
import { useCoreFilter } from '../../combobox/root/utils/useFilter';
import { useControlled } from '../../common/useControlled';
import { REASONS } from '../../internals/reasons';
import { stringifyAsLabel } from '../../internals/resolveValueLabel';

type ItemValue = AutocompleteItemValue<Items>;

const props = withDefaults(defineProps<AutocompleteRootSetupProps<Items>>(), {
  open: undefined,
  defaultOpen: false,
  value: undefined,
  defaultValue: undefined,
  disabled: false,
  readOnly: false,
  required: false,
  openOnInputClick: false,
  autoHighlight: false,
  keepHighlight: false,
  highlightItemOnHover: true,
  loopFocus: true,
  grid: false,
  virtualized: false,
  inline: false,
  modal: false,
  limit: -1,
  mode: 'list',
  submitOnItemClick: false,
  filter: undefined,
});

const emit = defineEmits<{
  /**
   * Event handler called when the input value of the autocomplete changes.
   */
  valueChange: [value: string, eventDetails: AutocompleteRootChangeEventDetails];
  'update:value': [value: string];
  /**
   * Event handler called when the popup is opened or closed.
   */
  openChange: [open: boolean, eventDetails: AutocompleteRootOpenChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  openChangeComplete: [open: boolean];
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as typing, `autoHighlight`, the
   *   item list changing, or the popup opening or closing.
   */
  itemHighlighted: [
    highlightedValue: ItemValue | undefined,
    eventDetails: AutocompleteRootHighlightEventDetails,
  ];
}>();

defineSlots<{ default(): unknown }>();

// Inline completion writes the highlighted label into the input, which `readOnly` must prevent.
const enableInline = computed(
  () => (props.mode === 'inline' || props.mode === 'both') && !props.readOnly,
);
const staticItems = computed(() => props.mode === 'inline' || props.mode === 'none');

const isControlled = computed(() => props.value !== undefined);
const [typedValue, setTypedValue] = useControlled<ComboboxInputElementValue>({
  controlled: () => props.value,
  default: () => props.defaultValue ?? '',
  name: 'Autocomplete',
  state: 'value',
});
const inlineInputValue = shallowRef('');

// Base UI clears the inline text in a passive effect. That effect runs after the layout effect in
// which the highlight follows the new list and asks for a completion, so it also removes that
// completion. This watcher runs before the `post` watchers of the highlight, so it drops each
// completion until the flush ends.
let dropCompletions = false;
watch([() => props.value, isControlled, enableInline], () => {
  if (isControlled.value || !enableInline.value) {
    inlineInputValue.value = '';
    dropCompletions = true;
    void nextTick(() => {
      dropCompletions = false;
    });
  }
});

const inputValue = computed<ComboboxInputElementValue>(() => {
  if (enableInline.value && inlineInputValue.value !== '') {
    return inlineInputValue.value;
  }
  return typedValue.value ?? '';
});

const collator = useCoreFilter(() => ({ locale: props.locale }));
const filter = computed(() => {
  if (staticItems.value || props.filter === null) {
    return null;
  }
  return props.filter ?? collator.contains;
});

const { actions, inputElement, hiddenInputProps } = useAriaCombobox<ItemValue, 'none'>(
  {
    selectionMode: 'none',
    selectedValue: undefined,
    defaultSelectedValue: undefined,
    get name() {
      return props.name;
    },
    get form() {
      return props.form;
    },
    get id() {
      return props.id;
    },
    get required() {
      return props.required;
    },
    get readOnly() {
      return props.readOnly;
    },
    get disabled() {
      return props.disabled;
    },
    get defaultOpen() {
      return props.defaultOpen;
    },
    get open() {
      return props.open;
    },
    get openOnInputClick() {
      return props.openOnInputClick;
    },
    get autoHighlight() {
      return props.autoHighlight;
    },
    get keepHighlight() {
      return props.keepHighlight;
    },
    get highlightItemOnHover() {
      return props.highlightItemOnHover;
    },
    get loopFocus() {
      return props.loopFocus;
    },
    get inputValue() {
      return inputValue.value;
    },
    get defaultInputValue() {
      return props.defaultValue;
    },
    get inputValueControlled() {
      return isControlled.value;
    },
    get grid() {
      return props.grid;
    },
    get items() {
      return props.items;
    },
    get filteredItems() {
      return props.filteredItems;
    },
    get filter() {
      return filter.value;
    },
    get filterQuery() {
      // An inline completion changes the input and not the query of the filter.
      return props.mode === 'both' ? String(typedValue.value ?? '').trim() : undefined;
    },
    get itemToStringLabel() {
      return props.itemToStringValue;
    },
    itemToStringValue: undefined,
    isItemEqualToValue: undefined,
    get virtualized() {
      return props.virtualized;
    },
    get inline() {
      return props.inline;
    },
    get modal() {
      return props.modal;
    },
    get limit() {
      return props.limit;
    },
    get autoComplete() {
      return props.mode;
    },
    formAutoComplete: undefined,
    get locale() {
      return props.locale;
    },
    get submitOnItemClick() {
      return props.submitOnItemClick;
    },
    fillInputOnItemPress: true,
  },
  {
    onSelectedValueChange() {},
    onInputValueChange(value, eventDetails) {
      inlineInputValue.value = '';
      emit('valueChange', value, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      setTypedValue(value);
      emit('update:value', value);
    },
    onOpenChange(open, eventDetails) {
      emit('openChange', open, eventDetails);
      if (!eventDetails.isCanceled) {
        emit('update:open', open);
      }
    },
    onOpenChangeComplete(open) {
      emit('openChangeComplete', open);
    },
    onItemHighlighted(highlightedValue, eventDetails) {
      emit('itemHighlighted', highlightedValue, eventDetails);
      if (eventDetails.reason === REASONS.pointer) {
        return;
      }
      inlineInputValue.value =
        enableInline.value && !dropCompletions && highlightedValue != null
          ? stringifyAsLabel(highlightedValue, props.itemToStringValue)
          : '';
    },
  },
);

defineExpose({ ...actions, inputElement });
</script>

<template>
  <slot />
  <input v-bind="hiddenInputProps()" />
</template>
