<script setup lang="ts">
import { shallowRef } from 'vue';
import { useAriaCombobox } from '../../src/combobox/root/AriaCombobox';

// The tests use this part in place of `Autocomplete.Root`. It gives the root of the combobox the
// selection mode `none`, so the input value is the value of the form. It holds the text itself and
// always gives it as `inputValue`, as `Autocomplete.Root` of Base UI does.
const props = defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  items?: readonly string[] | undefined;
  defaultInputValue?: string | undefined;
  defaultOpen?: boolean | undefined;
  submitOnItemClick?: boolean | undefined;
}>();

const emit = defineEmits<{ inputValueChange: [inputValue: string] }>();

const text = shallowRef(props.defaultInputValue ?? '');

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
    get defaultOpen() {
      return props.defaultOpen;
    },
    open: undefined,
    openOnInputClick: false,
    autoHighlight: undefined,
    keepHighlight: undefined,
    highlightItemOnHover: undefined,
    loopFocus: undefined,
    get inputValue() {
      return text.value;
    },
    get defaultInputValue() {
      return props.defaultInputValue;
    },
    inputValueControlled: false,
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
    get submitOnItemClick() {
      return props.submitOnItemClick;
    },
    fillInputOnItemPress: true,
  },
  {
    onSelectedValueChange() {},
    onInputValueChange(value) {
      emit('inputValueChange', value);
      text.value = value;
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
