<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { injectPositioner } from './root';
import type { ToastArrowProps, ToastArrowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ToastArrowProps>();
defineSlots<{
  default?(scope: { state: ToastArrowState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToastArrowState;
  }): unknown;
}>();

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

const state = computed<ToastArrowState>(() => ({
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
