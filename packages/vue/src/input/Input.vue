<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, useAttrs, useId, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useDeferredServerRender } from '../common/deferredServerRender';
import { useElement, type ElementSlotProps } from '../common/element';
import { useFormReset } from '../common/formEvents';
import { useModel } from '../common/model';
import {
  controlAttributes,
  fieldKey,
  joinDescribedBy,
  useControlId,
  useFieldControl,
} from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import type { InputEmits, InputProps, InputState } from './types';

type TextElement = HTMLInputElement | HTMLTextAreaElement;

defineOptions({ inheritAttrs: false });

const props = defineProps<InputProps>();
const emit = defineEmits<InputEmits>();
const slots = defineSlots<{
  element?(scope: ElementSlotProps<InputState>): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
// The label and the messages of the field can come after the input.
useDeferredServerRender();
const generatedId = useId();
const { element, setElement } = useElement<TextElement>();

const { value, setOwn, resetValue } = useModel(
  () => (props.modelValue === undefined ? undefined : String(props.modelValue)),
  String(props.modelValue ?? props.defaultValue ?? ''),
);

const elementId = useControlId(
  field,
  () => props.id,
  () => generatedId,
);
const inDisabledFieldset = useInDisabledFieldset(element);
const isDisabled = computed(() => !!field?.disabled || props.disabled || inDisabledFieldset.value);
const state = computed<InputState>(() => ({
  disabled: isDisabled.value,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => ({
  id: elementId.value,
  name: field?.name ?? props.name,
  disabled: isDisabled.value,
  readonly: props.readonly,
  value: value.value,
  ...(field && controlAttributes(field)),
  onInput,
  onBlur,
}));

watch(value, (next) => field?.setValue(next, next !== ''), { immediate: true });

useFormReset(element, () => {
  const reset = resetValue(String(props.defaultValue ?? ''));
  if (value.value !== reset) changeValue(reset);
  field?.onReset();
});

useFieldControl(field, element, {
  // The `element` slot can give the element another `id`.
  id: () => (slots.element && element.value?.id) || elementId.value,
  name: () => props.name,
  disabled: () => props.disabled || inDisabledFieldset.value,
  readOnly: () => props.readonly,
});

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, joinDescribedBy(attrs, field));
}

// The binding of `value` writes only a value that changed. When the parent refuses a value, or a
// listener cancels an edit, the element must show the value again. A write of the same value
// removes text that the value does not hold, such as the bad input of a number input
// (test/measurements/input.test.ts).
function showValue() {
  const el = element.value;
  if (el && el.value !== value.value) el.value = value.value;
}

function changeValue(next: string) {
  setOwn(next);
  emit('update:modelValue', next);
}

function onInput(event: Event) {
  const next = (event.currentTarget as TextElement).value;
  const details = createChangeEventDetails('none', event);
  emit('valueChange', next, details);
  if (!details.isCanceled) changeValue(next);
  // The parent can refuse or change a controlled value. Its answer arrives with its next render.
  nextTick(() => {
    showValue();
    if (!details.isCanceled) field?.onEdit();
  });
}

function onBlur(event: FocusEvent) {
  field?.onLeave(event.currentTarget as Element);
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
