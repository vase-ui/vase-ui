<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectSelectRoot } from './root';
import type { SelectIconProps, SelectIconState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SelectIconProps>();
defineSlots<{
  /** The content. The default is `▼`. */
  default?(scope: { state: SelectIconState }): unknown;
  element?(scope: ElementSlotProps<SelectIconState>): unknown;
}>();

const { root } = injectSelectRoot('Icon');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<SelectIconState>(() => ({ open: root.open }));

function elementProps() {
  return mergeProps(
    // A `<span>` has no `aria-expanded`, so the attribute gives the open state.
    { 'aria-hidden': 'true', 'data-popup-open': root.open ? '' : undefined },
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
    <slot :state="state">▼</slot>
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state">▼</slot>
  </span>
</template>
