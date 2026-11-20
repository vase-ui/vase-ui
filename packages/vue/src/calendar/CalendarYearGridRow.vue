<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarYearGridRowProps, CalendarYearGridRowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarYearGridRowProps>();
defineSlots<{
  default?(scope: { state: CalendarYearGridRowState }): unknown;
  element?(scope: ElementSlotProps<CalendarYearGridRowState>): unknown;
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
