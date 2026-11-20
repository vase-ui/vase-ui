<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarWeekProps, CalendarWeekState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarWeekProps>();
defineSlots<{
  /** The content before the days, such as `Calendar.WeekNumber`. */
  default?(): unknown;
  /** One day of the week. */
  day?(scope: { day: Temporal.PlainDate; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarWeekState;
    days: readonly Temporal.PlainDate[];
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps(stateAttributes(calendar.state), attrs);
}
</script>

<!-- prettier-ignore -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="calendar.state"
    :days="week.days"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot /><template v-for="(day, index) in week.days" :key="day.toString()"><slot name="day" :day="day" :index="index" /></template>
  </component>
  <tr v-else v-bind="elementProps()" :ref="setElement">
    <slot /><template v-for="(day, index) in week.days" :key="day.toString()"><slot name="day" :day="day" :index="index" /></template>
  </tr>
</template>
