<script setup lang="ts">
import { useAriaCombobox } from '../../src/combobox/root/AriaCombobox';

// The tests use this part in place of `Autocomplete.Root`. It gives the root of the combobox the
// selection mode `none`, so the input value is the value of the form.
const props = defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  items?: readonly string[] | undefined;
  defaultInputValue?: string | undefined;
}>();

const emit = defineEmits<{ inputValueChange: [inputValue: string] }>();

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
    required: undefined,
    readOnly: undefined,
    disabled: undefined,
    defaultOpen: undefined,
    open: undefined,
    openOnInputClick: false,
    autoHighlight: undefined,
    keepHighlight: undefined,
    highlightItemOnHover: undefined,
    loopFocus: undefined,
    inputValue: undefined,
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
    onInputValueChange(value) {
      emit('inputValueChange', value);
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
