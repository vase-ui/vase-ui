<script setup lang="ts" generic="Value = never, Multiple extends boolean = false, Item = Value">
import { useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useComboboxRoot } from './root';
import type {
  ComboboxRootChangeEventDetails,
  ComboboxRootHighlightEventDetails,
  ComboboxRootOpenChangeEventDetails,
  ComboboxRootProps,
} from './types';

type ValueChange = Multiple extends true ? Value[] : Value | null;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxRootProps<Value, Multiple, Item>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  inputValue: undefined,
  defaultInputValue: undefined,
  open: undefined,
  defaultOpen: false,
  items: undefined,
  filteredItems: undefined,
  filter: undefined,
  limit: -1,
  grid: false,
  virtualized: false,
  inline: false,
  modal: false,
  highlightItemOnHover: true,
  loopFocus: true,
  openOnInputClick: true,
  autoHighlight: false,
  required: false,
  disabled: false,
  readonly: false,
});
const emit = defineEmits<{
  /** The user changes the value. `details.cancel()` keeps the value as it was. */
  valueChange: [value: ValueChange, details: ComboboxRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: ValueChange];
  /** The text of the input changes. `details.cancel()` keeps the text as it was. */
  inputValueChange: [text: string, details: ComboboxRootChangeEventDetails];
  /** Comes after `inputValueChange`, unless a listener cancels it. `v-model:input-value` uses it. */
  'update:inputValue': [text: string];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: ComboboxRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** An item gets the highlight, or no item has it (`undefined`, with the index -1). */
  itemHighlighted: [value: Value | undefined, details: ComboboxRootHighlightEventDetails];
}>();
defineSlots<{ default?(): unknown }>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const {
  context,
  close,
  form: formInputs,
} = useComboboxRoot(
  {
    family: 'Combobox',
    get mode() {
      return props.multiple ? 'multiple' : 'single';
    },
    completion: 'list',
    get value() {
      return props.modelValue;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    get text() {
      return props.inputValue;
    },
    get defaultText() {
      return props.defaultInputValue;
    },
    get open() {
      return props.open;
    },
    get defaultOpen() {
      return props.defaultOpen;
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
    get limit() {
      return props.limit;
    },
    get locale() {
      return props.locale;
    },
    get grid() {
      return props.grid;
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
    get highlightItemOnHover() {
      return props.highlightItemOnHover;
    },
    get loopFocus() {
      return props.loopFocus;
    },
    get openOnInputClick() {
      return props.openOnInputClick;
    },
    get autoHighlight() {
      return props.autoHighlight;
    },
    keepHighlight: false,
    submitOnItemClick: false,
    get isItemEqualToValue() {
      return props.isItemEqualToValue;
    },
    get itemToStringLabel() {
      return props.itemToStringLabel;
    },
    get itemToStringValue() {
      return props.itemToStringValue;
    },
    get autocomplete() {
      return props.autocomplete;
    },
    get name() {
      return props.name;
    },
    get form() {
      return props.form;
    },
    get required() {
      return props.required;
    },
    get disabled() {
      return props.disabled;
    },
    get readonly() {
      return props.readonly;
    },
  },
  {
    value: (value, details) => emit('valueChange', value as ValueChange, details),
    updateValue: (value) => emit('update:modelValue', value as ValueChange),
    text: (text, details) => emit('inputValueChange', text, details),
    updateText: (text) => emit('update:inputValue', text),
    open: (open, details) => emit('openChange', open, details),
    updateOpen: (open) => emit('update:open', open),
    highlight: (value, details) => emit('itemHighlighted', value as Value | undefined, details),
  },
);

const setTextInput = (input: unknown) =>
  (context.textInput.value = input as HTMLInputElement | null);

defineExpose({
  close,
  element,
  get inputElement() {
    return context.textInput.value;
  },
});
</script>

<template>
  <component :is="as" v-if="as" v-bind="attrs" :ref="setElement">
    <slot />
    <input
      v-for="(text, index) in formInputs.values.value"
      :key="index"
      type="hidden"
      :name="context.name"
      :form="context.form"
      :disabled="context.disabled"
      :value="text"
    />
    <input
      v-if="formInputs.rendersInputs()"
      v-bind="formInputs.textInputProps()"
      :ref="setTextInput"
    />
  </component>
  <div v-else v-bind="attrs" :ref="setElement">
    <slot />
    <input
      v-for="(text, index) in formInputs.values.value"
      :key="index"
      type="hidden"
      :name="context.name"
      :form="context.form"
      :disabled="context.disabled"
      :value="text"
    />
    <input
      v-if="formInputs.rendersInputs()"
      v-bind="formInputs.textInputProps()"
      :ref="setTextInput"
    />
  </div>
</template>
