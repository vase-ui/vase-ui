<script setup lang="ts" generic="Item = unknown">
import { useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useComboboxRoot } from '../combobox/root';
import type {
  AutocompleteRootChangeEventDetails,
  AutocompleteRootHighlightEventDetails,
  AutocompleteRootOpenChangeEventDetails,
  AutocompleteRootProps,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AutocompleteRootProps<Item>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  open: undefined,
  defaultOpen: false,
  mode: 'list',
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
  openOnInputClick: false,
  autoHighlight: false,
  keepHighlight: false,
  submitOnItemClick: false,
  required: false,
  disabled: false,
  readonly: false,
});
const emit = defineEmits<{
  /** The text changes. `details.cancel()` keeps the text as it was. */
  valueChange: [value: string, details: AutocompleteRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: string];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: AutocompleteRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
  /** An item gets the highlight, or no item has it (`undefined`, with the index -1). */
  itemHighlighted: [value: Item | undefined, details: AutocompleteRootHighlightEventDetails];
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
    family: 'Autocomplete',
    mode: 'none',
    get completion() {
      return props.mode;
    },
    value: undefined,
    defaultValue: undefined,
    get text() {
      return props.modelValue;
    },
    get defaultText() {
      return props.defaultValue;
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
    get keepHighlight() {
      return props.keepHighlight;
    },
    get submitOnItemClick() {
      return props.submitOnItemClick;
    },
    isItemEqualToValue: undefined,
    get itemToStringLabel() {
      return props.itemToStringValue as ((value: unknown) => string) | undefined;
    },
    get itemToStringValue() {
      return props.itemToStringValue as ((value: unknown) => string) | undefined;
    },
    autocomplete: undefined,
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
    value: () => {},
    updateValue: () => {},
    text: (text, details) =>
      emit('valueChange', text, details as AutocompleteRootChangeEventDetails),
    updateText: (text) => emit('update:modelValue', text),
    open: (open, details) => emit('openChange', open, details),
    updateOpen: (open) => emit('update:open', open),
    highlight: (value, details) => emit('itemHighlighted', value as Item | undefined, details),
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
      v-bind="formInputs.textProps()"
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
      v-bind="formInputs.textProps()"
      :ref="setTextInput"
    />
  </div>
</template>
