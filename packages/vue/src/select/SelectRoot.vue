<script setup lang="ts" generic="Value = never, Multiple extends boolean | undefined = false">
// vue-tsc resolves `Value` before it checks a listener of a template. With the default `never`,
// that check accepts a typed parameter and keeps `null` in the type.
import { computed, inject, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { fieldKey, useControlId } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { isSelectedValueDirty } from '../common/itemEquality';
import { useSelectForm } from './form';
import { useSelectRoot } from './root';
import type { SelectOutputValue, SelectRootEmits, SelectRootProps } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectRootProps<Value, Multiple>>(), {
  modelValue: undefined,
  defaultValue: null,
  open: undefined,
  defaultOpen: false,
  modal: true,
  highlightItemOnHover: true,
  required: false,
  readonly: false,
  disabled: false,
});
const emit = defineEmits<SelectRootEmits<Value, Multiple>>();
defineSlots<{ default?(): unknown }>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const { element: input, setElement: setInput } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
const ownDisabled = computed(() => props.disabled || inDisabledFieldset.value);
const isDisabled = computed(() => ownDisabled.value || !!field?.disabled);
const triggerId = useControlId(
  field,
  () => props.id,
  () => generatedId,
);

const { context, value, setOwn, resetValue, close } = useSelectRoot(
  props,
  { field, triggerId: () => triggerId.value, disabled: () => isDisabled.value },
  emit,
);

const inputs = useSelectForm(
  context,
  {
    get id() {
      return triggerId.value;
    },
    get name() {
      return props.name;
    },
    get form() {
      return props.form;
    },
    get autocomplete() {
      return props.autocomplete;
    },
    get itemToStringValue() {
      return props.itemToStringValue;
    },
    get isItemEqualToValue() {
      return props.isItemEqualToValue;
    },
    get ownDisabled() {
      return ownDisabled.value;
    },
  },
  input,
  // A native reset is no change of the user: the value goes back, with `update:modelValue` only.
  () => {
    const reset = resetValue();
    field?.onReset(reset);
    if (!isSelectedValueDirty(value.value, reset, props.isItemEqualToValue ?? Object.is)) return;
    setOwn(reset);
    emit('update:modelValue', reset as SelectOutputValue<Value, Multiple>);
  },
);

defineExpose({
  element,
  /** The visually hidden text input of the form. */
  inputElement: input,
  /** Closes the popup with the reason `'imperative-action'`. */
  close,
});
</script>

<template>
  <component :is="as" v-if="as" v-bind="attrs" :ref="setElement">
    <slot />
    <input v-bind="inputs.textProps()" :ref="setInput" />
    <input
      v-for="(text, index) in inputs.values.value"
      :key="index"
      type="hidden"
      :name="inputs.name.value"
      :form="form"
      :disabled="isDisabled"
      :value="text"
    />
  </component>
  <div v-else v-bind="attrs" :ref="setElement">
    <slot />
    <input v-bind="inputs.textProps()" :ref="setInput" />
    <input
      v-for="(text, index) in inputs.values.value"
      :key="index"
      type="hidden"
      :name="inputs.name.value"
      :form="form"
      :disabled="isDisabled"
      :value="text"
    />
  </div>
</template>
