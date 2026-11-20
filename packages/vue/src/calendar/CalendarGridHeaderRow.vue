<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import type { DayOfWeek } from '../internals/date-time/temporal';
import { injectMonth } from './month';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarGridHeaderRowProps, CalendarGridHeaderRowState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarGridHeaderRowProps>();
defineSlots<{
  /** The content before the names of the days, such as `Calendar.WeekNumberHeader`. */
  default?(): unknown;
  /** One day of the week, from the first day of the week. */
  weekday?(scope: { weekday: DayOfWeek; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarGridHeaderRowState;
    weekdays: readonly DayOfWeek[];
  }): unknown;
}>();

const calendar = injectCalendar();
const month = injectMonth();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const weekdays = computed(() => (month?.page ?? calendar.pages[0])?.weekdays ?? []);

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
    :weekdays="weekdays"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot /><template v-for="(weekday, index) in weekdays" :key="weekday"><slot name="weekday" :weekday="weekday" :index="index" /></template>
  </component>
  <tr v-else v-bind="elementProps()" :ref="setElement">
    <slot /><template v-for="(weekday, index) in weekdays" :key="weekday"><slot name="weekday" :weekday="weekday" :index="index" /></template>
  </tr>
</template>
