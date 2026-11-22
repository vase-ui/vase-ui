<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs, useId } from 'vue';
import { useChecked } from '../common/checked';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement, type ElementSlotProps } from '../common/element';
import { fieldKey, joinDescribedBy, useControlId, useFieldControl } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import type { SwitchEmits, SwitchProps, SwitchState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SwitchProps>(), {
  // An absent `modelValue` makes the switch uncontrolled.
  modelValue: undefined,
});
const emit = defineEmits<SwitchEmits>();
const slots = defineSlots<{
  element?(scope: ElementSlotProps<SwitchState>): unknown;
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
const isDisabled = computed(() => !!field?.disabled || props.disabled || inDisabledFieldset.value);
const elementId = useControlId(
  field,
  () => props.id,
  () => generatedId,
);
const state = computed<SwitchState>(() => ({
  checked: checked.value,
  disabled: isDisabled.value,
  readonly: props.readonly,
  required: props.required,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

useFieldControl(field, element, {
  // The `element` slot can give the element another `id`.
  id: () => (slots.element && element.value?.id) || elementId.value,
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
      id: elementId.value,
      name: field?.name ?? props.name,
      disabled: isDisabled.value,
      ...attributes.value,
    },
    joinDescribedBy(attrs, field),
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
