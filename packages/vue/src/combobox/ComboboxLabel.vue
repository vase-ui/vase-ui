<script setup lang="ts">
import { computed, inject, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { fieldKey, fieldStateAttributes } from '../field/control';
import { injectComboboxRoot } from './root';
import type { ComboboxLabelProps, ComboboxLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ComboboxLabelProps>();
defineSlots<{
  default?(scope: { state: ComboboxLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxLabelState;
  }): unknown;
}>();

const context = injectComboboxRoot('Label');
const field = inject(fieldKey, null);
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
// Nuxt removes `onUnmounted` from its server build, with its arguments.
const removeLabel = context.setLabel({
  get id() {
    return elementId.value;
  },
});
onUnmounted(removeLabel);

const state = computed<ComboboxLabelState>(() => ({
  disabled: context.disabled,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));

// A press on the label moves the focus to the control. A `<label>` would open a popup at a press
// on its button (test/measurements/combobox.test.ts, C9).
function onClick() {
  if (!context.disabled) context.control?.focus();
}

function elementProps() {
  return mergeProps(
    { id: elementId.value, ...fieldStateAttributes(state.value, context.disabled), onClick },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
