<script setup lang="ts">
import { computed, mergeProps, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectToastRoot } from './root';
import type { ToastContentProps, ToastContentState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ToastContentProps>();
defineSlots<{
  default?(scope: { state: ToastContentState }): unknown;
  element?(scope: ElementSlotProps<ToastContentState>): unknown;
}>();

const root = injectToastRoot('Content');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// A content with a fixed height gets no resize when its text grows, so a mutation also measures
// the root (test/measurements/toast.test.ts).
watch(
  element,
  (content, _, onCleanup) => {
    if (!content) return;
    root.measure();
    let frame = 0;
    // A measure during observer delivery can resize an ancestor or sibling toast and cause a
    // ResizeObserver loop error.
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.measure());
    });
    const mutation = new MutationObserver(() => root.measure());
    resize.observe(content);
    mutation.observe(content, { childList: true, characterData: true, subtree: true });
    onCleanup(() => {
      resize.disconnect();
      mutation.disconnect();
      cancelAnimationFrame(frame);
    });
  },
  { immediate: true, flush: 'post' },
);

const state = computed<ToastContentState>(() => ({
  expanded: root.expanded,
  behind: root.behind,
}));

function elementProps() {
  return mergeProps(
    {
      'data-expanded': state.value.expanded ? '' : undefined,
      'data-behind': state.value.behind ? '' : undefined,
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
