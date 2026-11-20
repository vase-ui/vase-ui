<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import type { ElementSlotProps } from '../../src/types';
import { useElement } from '../../src/use-element';

// A component of a developer in the form of a part, with `useElement` and Vue alone.
interface NoticeState {
  tone: 'info' | 'warning';
}
defineOptions({ inheritAttrs: false });
const { tone = 'info' } = defineProps<{ tone?: NoticeState['tone'] }>();
defineSlots<{
  default?(scope: { state: NoticeState }): unknown;
  element?(scope: ElementSlotProps<NoticeState>): unknown;
}>();
const attrs = useAttrs();
const { element, setElement } = useElement();
const state = computed<NoticeState>(() => ({ tone }));
const elementProps = () => mergeProps({ role: 'note', 'data-tone': tone }, attrs);
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
  <p v-else v-bind="elementProps()" :ref="setElement"><slot :state="state" /></p>
</template>
