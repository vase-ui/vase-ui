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
  focusableWhenDisabled: false,
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
const isDisabled = computed(() => !!field?.disabled || props.disabled || inDisabledFieldset.value);
// A disabled `<fieldset>` takes each input in it out of the tab order. A `Fieldset.Root` with
// another element does the same.
const keepsFocus = computed(
  () => isDisabled.value && props.focusableWhenDisabled && !inDisabledFieldset.value,
);

const { checked, attributes } = useChecked({
  model: () => props.modelValue,
  defaultChecked: () => props.defaultChecked,
  readonly: () => props.readonly,
  required: () => props.required && !keepsFocus.value,
  uncheckedValue: () => props.uncheckedValue,
  element,
  field,
  emitChange: (next, details) => emit('checkedChange', next, details),
  emitModel: (next) => emit('update:modelValue', next),
});
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

// A native disabled switch gets no `mousedown`, `mouseup` or `click`, and no ancestor gets them
// in the bubble phase (test/measurements/switch.test.ts).
function stopWhileDisabled(event: Event) {
  if (!keepsFocus.value) return;
  if (event.type === 'click') event.preventDefault();
  event.stopImmediatePropagation();
}

// Enter on a native checkbox submits its form (test/measurements/switch.test.ts).
function onKeydown(event: KeyboardEvent) {
  if (keepsFocus.value && event.key === 'Enter') event.preventDefault();
}

function elementProps() {
  return mergeProps(
    {
      onClick: stopWhileDisabled,
      onMousedown: stopWhileDisabled,
      onMouseup: stopWhileDisabled,
    },
    {
      type: 'checkbox',
      role: 'switch',
      id: elementId.value,
      // An input with no `name` puts no entry in `FormData` (test/measurements/switch.test.ts).
      name: keepsFocus.value ? undefined : (field?.name ?? props.name),
      disabled: isDisabled.value && !keepsFocus.value,
      'aria-disabled': keepsFocus.value ? 'true' : undefined,
      ...attributes.value,
    },
    joinDescribedBy(attrs, field),
    // Runs after the key listeners of the developer, so they see `defaultPrevented` as false.
    { onKeydown },
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
