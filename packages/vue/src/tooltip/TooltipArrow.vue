<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectPositioner, injectTooltipRoot } from './root';
import type { TooltipArrowProps, TooltipArrowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<TooltipArrowProps>();
defineSlots<{
  default?(scope: { state: TooltipArrowState }): unknown;
  element?(scope: ElementSlotProps<TooltipArrowState>): unknown;
}>();

const context = injectTooltipRoot('Arrow');
const placement = injectPositioner('Arrow');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
watch(
  element,
  (arrow, _, onCleanup) => {
    if (arrow) onCleanup(placement.arrow.addElement(arrow));
  },
  { immediate: true },
);

const state = computed<TooltipArrowState>(() => ({
  open: context.root.open,
  side: placement.side.value,
  align: placement.align.value,
  uncentered: placement.arrow.uncentered.value,
  instant: context.instant,
}));

function elementProps() {
  return mergeProps(
    {
      'aria-hidden': 'true',
      style: placement.arrow.style.value,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-uncentered': state.value.uncentered ? '' : undefined,
      'data-instant': state.value.instant,
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
