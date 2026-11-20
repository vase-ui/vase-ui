<script setup lang="ts" generic="Value = never, Multiple extends boolean | undefined = false">
// vue-tsc resolves `Value` before it checks a listener of a template. With the default `never`,
// that check accepts a typed parameter and keeps `null` in the type.
import { computed, inject, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { fieldKey } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { isSelectedValueDirty } from '../internals/itemEquality';
import { useSelectForm } from './form';
import { useSelectRoot } from './root';
import type {
  SelectOutputValue,
  SelectRootChangeEventDetails,
  SelectRootOpenChangeEventDetails,
  SelectRootProps,
} from './types';

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
const emit = defineEmits<{
  /** The user changes the value. `details.cancel()` keeps the value as it was. */
  valueChange: [value: SelectOutputValue<Value, Multiple>, details: SelectRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: SelectOutputValue<Value, Multiple>];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: SelectRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
}>();
defineSlots<{ default?(): unknown }>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const { element: input, setElement: setInput } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
const ownDisabled = computed(() => props.disabled || inDisabledFieldset.value);
const isDisabled = computed(() => ownDisabled.value || !!field?.disabled);
const triggerId = computed(() => givenId(props.id) ?? field?.controlId ?? generatedId);

const { context, value, firstValue, setOwn, close } = useSelectRoot(
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
    field?.onReset(firstValue);
    if (!isSelectedValueDirty(value.value, firstValue, props.isItemEqualToValue ?? Object.is)) {
      return;
    }
    setOwn(firstValue);
    emit('update:modelValue', firstValue as SelectOutputValue<Value, Multiple>);
  },
);

defineExpose({ element, inputElement: input, close });
</script>

<template>
  <component :is="as" v-if="as" v-bind="attrs" :ref="setElement">
    <slot />
    <input v-bind="inputs.textProps()" :ref="setInput" />
    <input
      v-for="(text, index) in inputs.hiddenValues.value"
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
      v-for="(text, index) in inputs.hiddenValues.value"
      :key="index"
      type="hidden"
      :name="inputs.name.value"
      :form="form"
      :disabled="isDisabled"
      :value="text"
    />
  </div>
</template>
