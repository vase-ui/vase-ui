<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import type { ComboboxIconProps, ComboboxIconState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxIconProps>();
defineSlots<{
  default?(scope: { state: ComboboxIconState }): unknown;
  element?(scope: ElementSlotProps<ComboboxIconState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: ComboboxIconState = {};

function elementProps() {
  return mergeProps({ 'aria-hidden': 'true' }, attrs);
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
    <slot :state="state">▼</slot>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state">▼</slot>
  </span>
</template>
