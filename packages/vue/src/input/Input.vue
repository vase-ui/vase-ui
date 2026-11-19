<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, ref, useAttrs, useId, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { fieldKey, fieldStateAttributes } from '../field/control';
import type { InputChangeEventDetails, InputProps, InputState } from './types';

type TextElement = HTMLInputElement | HTMLTextAreaElement;

defineOptions({ inheritAttrs: false });

const props = defineProps<InputProps>();
const emit = defineEmits<{
  valueChange: [value: string, details: InputChangeEventDetails];
  'update:modelValue': [value: string];
}>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: InputState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const generatedId = useId();
const { element, setElement } = useElement<TextElement>();

const firstValue = String(props.modelValue ?? props.defaultValue ?? '');
// The value while no `modelValue` controls it: the last value, controlled or not.
const ownValue = ref(firstValue);
const value = computed(() =>
  props.modelValue === undefined ? ownValue.value : String(props.modelValue),
);

const id = computed(() => props.id || field?.controlId || generatedId);
const disabled = computed(() => field?.disabled || props.disabled);
const state = computed<InputState>(() => ({
  disabled: disabled.value,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

const ownProps = computed(() => ({
  id: id.value,
  name: field?.name ?? props.name,
  disabled: disabled.value,
  readonly: props.readonly,
  value: value.value,
  ...(field && {
    ...fieldStateAttributes(field.state),
    'aria-invalid': field.state.valid === false ? 'true' : undefined,
    'aria-describedby': field.describedBy,
  }),
  onInput,
  onBlur,
}));

watch(
  value,
  (next) => {
    ownValue.value = next;
    field?.setValue(next);
  },
  { immediate: true },
);

watch(
  element,
  (el, _, onCleanup) => {
    if (!el) return;
    const form = el.form;
    form?.addEventListener('reset', onReset);
    const removeControl = field?.setControl({
      element: el,
      get id() {
        return id.value;
      },
      get name() {
        return props.name;
      },
      get disabled() {
        return props.disabled;
      },
      get readOnly() {
        return props.readonly;
      },
    });
    onCleanup(() => {
      form?.removeEventListener('reset', onReset);
      removeControl?.();
    });
  },
  { flush: 'post' },
);

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
}

// The binding of `value` writes only a value that changed. When the parent refuses a value, or a
// listener cancels an edit, the element must show the value again.
function showValue() {
  if (element.value) element.value.value = value.value;
}

function changeValue(next: string) {
  ownValue.value = next;
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

function onReset(event: Event) {
  // A form resets only the controls that it owns at that moment: an element that `KeepAlive`
  // holds has no form.
  if (element.value?.form !== event.currentTarget) return;
  // The form resets its controls to their `value` attribute, which Vue sets to each value, so
  // Input gives the first value. A later listener can still prevent the reset, so Input waits
  // for the end of the event.
  setTimeout(() => {
    if (event.defaultPrevented) return;
    field?.onReset(firstValue);
    if (value.value !== firstValue) changeValue(firstValue);
  });
}

function onBlur() {
  field?.onLeave();
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
