<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarFooterProps, CalendarFooterState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarFooterProps>();
defineSlots<{
  default?(scope: { state: CalendarFooterState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarFooterState;
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps({ role: 'status', 'aria-live': 'polite', ...stateAttributes(calendar.state) }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="calendar.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="calendar.state" />
  </div>
</template>
