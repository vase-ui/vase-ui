<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { fieldStateAttributes } from '../field/control';
import { injectSelectRoot } from './root';
import type { SelectLabelProps, SelectLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<SelectLabelProps>();
defineSlots<{
  default?(scope: { state: SelectLabelState }): unknown;
  element?(scope: ElementSlotProps<SelectLabelState>): unknown;
}>();

const context = injectSelectRoot('Label');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const label = {
  get id() {
    return givenId(props.id) ?? generatedId;
  },
};
const removeLabel = context.addLabel(label);
onUnmounted(removeLabel);

const state = computed<SelectLabelState>(() => ({
  disabled: context.disabled,
  touched: context.field?.state.touched ?? false,
  dirty: context.field?.state.dirty ?? false,
  valid: context.field?.state.valid ?? null,
  filled: context.field?.state.filled ?? false,
}));

function elementProps() {
  return mergeProps(
    {
      id: label.id,
      ...fieldStateAttributes(state.value, state.value.disabled),
      // A `<label for>` of a button sends it a `click`, which would open the popup
      // (test/measurements/select.test.ts). The label of a native select gives only the focus.
      onClick() {
        (context.root.activeTrigger as HTMLElement | null)?.focus();
      },
    },
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
