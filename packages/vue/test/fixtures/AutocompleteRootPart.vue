<script setup lang="ts">
import { useControlled } from '../../src/common/useControlled';
import { useAriaCombobox } from '../../src/combobox/root/AriaCombobox';
import type { AriaCombobox } from '../../src/combobox/root/AriaCombobox';

// The tests use this part in place of `Autocomplete.Root`. It gives the root of the combobox the
// selection mode `none`, so the input value is the value of the form. As `Autocomplete.Root`, it
// keeps the input value itself and always gives it to the root.
const props = defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
  items?: readonly string[] | undefined;
  value?: string | undefined;
  defaultInputValue?: string | undefined;
}>();

const emit = defineEmits<{
  inputValueChange: [inputValue: string, eventDetails: AriaCombobox.ChangeEventDetails];
  'update:value': [value: string];
}>();

const [inputValue, setInputValue] = useControlled<string>({
  controlled: () => props.value,
  default: () => props.defaultInputValue ?? '',
  name: 'AutocompleteRootPart',
  state: 'value',
});

const { hiddenInputProps } = useAriaCombobox<string>(
  {
    selectionMode: 'none',
    selectedValue: undefined,
    defaultSelectedValue: undefined,
    get name() {
      return props.name;
    },
    form: undefined,
    get id() {
      return props.id;
    },
    get required() {
      return props.required;
    },
    readOnly: undefined,
    disabled: undefined,
    defaultOpen: undefined,
    open: undefined,
    openOnInputClick: false,
    autoHighlight: undefined,
    keepHighlight: undefined,
    highlightItemOnHover: undefined,
    loopFocus: undefined,
    get inputValue() {
      return inputValue.value;
    },
    get defaultInputValue() {
      return props.defaultInputValue;
    },
    grid: undefined,
    get items() {
      return props.items;
    },
    filteredItems: undefined,
    filter: undefined,
    filterQuery: undefined,
    get inputValueControlled() {
      return props.value !== undefined;
    },
    itemToStringLabel: undefined,
    itemToStringValue: undefined,
    isItemEqualToValue: undefined,
    virtualized: undefined,
    inline: undefined,
    modal: undefined,
    limit: undefined,
    autoComplete: undefined,
    formAutoComplete: undefined,
    locale: undefined,
    submitOnItemClick: undefined,
    fillInputOnItemPress: true,
  },
  {
    onSelectedValueChange() {},
    onInputValueChange(value, eventDetails) {
      emit('inputValueChange', value, eventDetails);
      if (!eventDetails.isCanceled) {
        setInputValue(value);
        emit('update:value', value);
      }
    },
    onOpenChange() {},
    onOpenChangeComplete() {},
    onItemHighlighted() {},
  },
);
</script>

<template>
  <slot />
  <input v-bind="hiddenInputProps()" />
</template>
