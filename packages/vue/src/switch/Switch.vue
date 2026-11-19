<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs, useId } from 'vue';
import { useChecked } from '../common/checked';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement } from '../common/element';
import { fieldKey, useFieldControl } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import type { SwitchChangeEventDetails, SwitchProps, SwitchState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchProps>(), {
  // An absent `modelValue` makes the switch uncontrolled.
  modelValue: undefined,
});
const emit = defineEmits<{
  checkedChange: [checked: boolean, details: SwitchChangeEventDetails];
  'update:modelValue': [checked: boolean];
}>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SwitchState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
// The label and the messages of the field can come after the switch.
useDeferredServerRender();
const generatedId = useId();
const { element, setElement } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const { checked, attributes } = useChecked({
  model: () => props.modelValue,
  defaultChecked: () => props.defaultChecked,
  readonly: () => props.readonly,
  required: () => props.required,
  uncheckedValue: () => props.uncheckedValue,
  element,
  field,
  emitChange: (next, details) => emit('checkedChange', next, details),
  emitModel: (next) => emit('update:modelValue', next),
});
const disabled = computed(() => !!field?.disabled || props.disabled || inDisabledFieldset.value);
const id = computed(() => props.id || field?.controlId || generatedId);
const state = computed<SwitchState>(() => ({
  checked: checked.value,
  disabled: disabled.value,
  readonly: props.readonly,
  required: props.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

useFieldControl(field, element, {
  id: () => id.value,
  name: () => props.name,
  disabled: () => props.disabled || inDisabledFieldset.value,
  readOnly: () => props.readonly,
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      type: 'checkbox',
      role: 'switch',
      id: id.value,
      name: field?.name ?? props.name,
      disabled: disabled.value,
      ...attributes.value,
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
