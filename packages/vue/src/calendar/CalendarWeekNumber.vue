<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { formatNumber } from '../internals/date-time/calendar/formatText';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarWeekNumberProps, CalendarWeekNumberState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<CalendarWeekNumberProps>();
defineSlots<{
  default?(scope: { state: CalendarWeekNumberState; text: string }): unknown;
  element?(
    scope: ElementSlotProps<CalendarWeekNumberState> & {
      text: string;
    },
  ): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<CalendarWeekNumberState>(() => ({
  ...calendar.state,
  weekNumber: calendar.weekNumber(props.week),
}));
const text = computed(() => formatNumber(state.value.weekNumber, calendar.locale));

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      scope: 'row',
      'data-week-number': String(state.value.weekNumber),
      ...stateAttributes(state.value),
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :text="text"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text">{{ text }}</slot>
  </component>
  <th v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text">{{ text }}</slot>
  </th>
</template>
