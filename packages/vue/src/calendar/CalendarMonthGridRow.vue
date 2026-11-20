<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarMonthGridRowProps, CalendarMonthGridRowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarMonthGridRowProps>();
defineSlots<{
  default?(scope: { state: CalendarMonthGridRowState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthGridRowState;
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps({ role: 'row', ...stateAttributes(calendar.state) }, attrs);
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
