<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectProgressRoot, statusAttributes } from './root';
import type { ProgressValueProps, ProgressValueState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ProgressValueProps>();
defineSlots<{
  default?(scope: {
    formattedValue: string | null;
    value: number | null;
    state: ProgressValueState;
  }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressValueState;
    formattedValue: string | null;
    value: number | null;
  }): unknown;
}>();

const root = injectProgressRoot('Value');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();

defineExpose({ element });

// The root has the text in `aria-valuetext`.
function elementProps() {
  return mergeProps({ 'aria-hidden': 'true', ...statusAttributes(root.state) }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
    :formattedValue="root.formattedValue"
    :value="root.value"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot
      v-if="$slots.default"
      :formattedValue="root.formattedValue"
      :value="root.value"
      :state="root.state"
    />
    <template v-else-if="root.formattedValue !== null">{{ root.formattedValue }}</template>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot
      v-if="$slots.default"
      :formattedValue="root.formattedValue"
      :value="root.value"
      :state="root.state"
    />
    <template v-else-if="root.formattedValue !== null">{{ root.formattedValue }}</template>
  </span>
</template>
