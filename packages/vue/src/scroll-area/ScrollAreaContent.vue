<script setup lang="ts">
import { mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectScrollArea, injectViewport, stateAttributes } from './root';
import type { ScrollAreaContentProps, ScrollAreaContentState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ScrollAreaContentProps>();
defineSlots<{
  default?(scope: { state: ScrollAreaContentState }): unknown;
  element?(scope: ElementSlotProps<ScrollAreaContentState>): unknown;
}>();

injectViewport();
const root = injectScrollArea('Content');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// The content can change its size with no change of the size of the viewport.
watch(
  element,
  (target, _, onCleanup) => {
    if (target) onCleanup(root.observe(target));
  },
  { flush: 'post' },
);

defineExpose({ element });

function elementProps() {
  return mergeProps({ style: { minWidth: 'fit-content' }, ...stateAttributes(root.state) }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </div>
</template>
