<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectSelectPositioner, injectSelectRoot } from './root';
import type { SelectArrowProps, SelectArrowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SelectArrowProps>();
defineSlots<{
  default?(scope: { state: SelectArrowState }): unknown;
  element?(scope: ElementSlotProps<SelectArrowState>): unknown;
}>();

const { root, aligned } = injectSelectRoot('Arrow');
const placement = injectSelectPositioner('Arrow');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
watch(
  element,
  (arrow, _, onCleanup) => {
    if (arrow) onCleanup(placement.arrow.addElement(arrow));
  },
  { immediate: true },
);

const state = computed<SelectArrowState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  uncentered: placement.arrow.uncentered.value,
}));

function elementProps() {
  return mergeProps(
    {
      'aria-hidden': 'true',
      style: placement.arrow.style.value,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-uncentered': state.value.uncentered ? '' : undefined,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- A popup that covers the trigger points to nothing, so it has no arrow. -->
<template>
  <slot
    v-if="!aligned && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="!aligned && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="!aligned" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
