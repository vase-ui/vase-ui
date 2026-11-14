<script lang="ts">
import type { AriaCombobox, AriaComboboxProps, AriaComboboxState } from './AriaCombobox';

type ModeFromMultiple<Multiple extends boolean | undefined> = Multiple extends true
  ? 'multiple'
  : 'single';

type ComboboxInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

type ComboboxOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface ComboboxRootProps<
  Value,
  Multiple extends boolean | undefined = false,
  Item = Value,
> extends Omit<
  AriaComboboxProps<Value, ModeFromMultiple<Multiple>, Item>,
  | 'fillInputOnItemPress'
  | 'autoComplete'
  | 'formAutoComplete'
  | 'submitOnItemClick'
  | 'autoHighlight'
  | 'keepHighlight'
  | 'highlightItemOnHover'
  | 'itemToStringLabel'
  | 'itemToStringValue'
  | 'isItemEqualToValue'
  | 'filterQuery'
  | 'inputValueControlled'
  | 'selectionMode'
  | 'defaultSelectedValue'
  | 'selectedValue'
> {
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * Whether the first matching item is highlighted automatically while filtering.
   * @default false
   */
  autoHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
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
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `value` prop instead.
   */
  defaultValue?: ComboboxInputValue<Value, Multiple> | null | undefined;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  value?: ComboboxInputValue<Value, Multiple> | null | undefined;
}

export interface ComboboxRootState extends AriaComboboxState {}

export type ComboboxRootActions = AriaCombobox.Actions;

export type ComboboxRootOpenChangeEventDetails = AriaCombobox.OpenChangeEventDetails;

export type ComboboxRootChangeEventReason = AriaCombobox.ChangeEventReason;
export type ComboboxRootChangeEventDetails = AriaCombobox.ChangeEventDetails;

export type ComboboxRootHighlightEventReason = AriaCombobox.HighlightEventReason;
export type ComboboxRootHighlightEventDetails = AriaCombobox.HighlightEventDetails;
</script>

<script setup lang="ts" generic="Value, Multiple extends boolean | undefined = false, Item = Value">
import { useAriaCombobox } from './AriaCombobox';

const props = withDefaults(defineProps<ComboboxRootProps<Value, Multiple, Item>>(), {
  open: undefined,
  defaultOpen: false,
  value: undefined,
  defaultValue: undefined,
  inputValue: undefined,
  defaultInputValue: undefined,
  disabled: false,
  readOnly: false,
  required: false,
  openOnInputClick: true,
  autoHighlight: false,
  highlightItemOnHover: true,
  loopFocus: true,
  grid: false,
  virtualized: false,
  inline: false,
  modal: false,
  limit: -1,
  filter: undefined,
});

type ValueChange = ComboboxOutputValue<Value, Multiple> | (Multiple extends true ? never : null);

const emit = defineEmits<{
  /**
   * Event handler called when the selected value of the combobox changes.
   */
  valueChange: [value: ValueChange, eventDetails: ComboboxRootChangeEventDetails];
  'update:value': [value: ValueChange];
  /**
   * Event handler called when the input value changes.
   */
  inputValueChange: [inputValue: string, eventDetails: ComboboxRootChangeEventDetails];
  'update:inputValue': [inputValue: string];
  /**
   * Event handler called when the popup is opened or closed.
   */
  openChange: [open: boolean, eventDetails: ComboboxRootOpenChangeEventDetails];
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
    highlightedValue: Value | undefined,
    eventDetails: ComboboxRootHighlightEventDetails,
  ];
}>();

defineSlots<{ default(): unknown }>();

const {
  actions,
  inputElement,
  hiddenInputProps,
  hiddenValues,
  name: inputName,
  disabled: isDisabled,
} = useAriaCombobox<Value, ModeFromMultiple<Multiple>, Item>(
  {
    get selectionMode() {
      return (props.multiple ? 'multiple' : 'single') as ModeFromMultiple<Multiple>;
    },
    get selectedValue() {
      return props.value as any;
    },
    get defaultSelectedValue() {
      return props.defaultValue as any;
    },
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
    keepHighlight: undefined,
    get highlightItemOnHover() {
      return props.highlightItemOnHover;
    },
    get loopFocus() {
      return props.loopFocus;
    },
    get inputValue() {
      return props.inputValue;
    },
    get defaultInputValue() {
      return props.defaultInputValue;
    },
    inputValueControlled: undefined,
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
      return props.filter;
    },
    filterQuery: undefined,
    get itemToStringLabel() {
      return props.itemToStringLabel;
    },
    get itemToStringValue() {
      return props.itemToStringValue;
    },
    get isItemEqualToValue() {
      return props.isItemEqualToValue;
    },
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
    autoComplete: undefined,
    get formAutoComplete() {
      return props.autoComplete;
    },
    get locale() {
      return props.locale;
    },
    submitOnItemClick: undefined,
    fillInputOnItemPress: undefined,
  },
  {
    onSelectedValueChange(value, eventDetails) {
      emit('valueChange', value, eventDetails);
      if (!eventDetails.isCanceled) {
        emit('update:value', value);
      }
    },
    onInputValueChange(value, eventDetails) {
      emit('inputValueChange', value, eventDetails);
      if (!eventDetails.isCanceled) {
        emit('update:inputValue', value);
      }
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
    onItemHighlighted(value, eventDetails) {
      emit('itemHighlighted', value, eventDetails);
    },
  },
);

defineExpose({ ...actions, inputElement });
</script>

<template>
  <slot />
  <input v-bind="hiddenInputProps()" />
  <input
    v-for="hiddenValue in hiddenValues"
    :key="hiddenValue"
    type="hidden"
    :form="form"
    :name="inputName"
    :value="hiddenValue"
    :disabled="isDisabled"
  />
</template>
