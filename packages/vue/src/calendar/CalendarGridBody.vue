<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectRequiredMonth } from './month';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarGridBodyProps, CalendarGridBodyState, CalendarWeek } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarGridBodyProps>();
defineSlots<{
  /** One week of the month. */
  week?(scope: { week: CalendarWeek; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarGridBodyState;
    weeks: readonly CalendarWeek[];
  }): unknown;
}>();

const calendar = injectCalendar();
const month = injectRequiredMonth();
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
    :weeks="month.page.weeks"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(week, index) in month.page.weeks" :key="week.start.toString()"><slot name="week" :week="week" :index="index" /></template>
  </component>
  <tbody v-else v-bind="elementProps()" :ref="setElement">
    <template v-for="(week, index) in month.page.weeks" :key="week.start.toString()"><slot name="week" :week="week" :index="index" /></template>
  </tbody>
</template>
