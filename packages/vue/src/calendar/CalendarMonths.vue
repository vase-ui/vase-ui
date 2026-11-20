<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarMonthsProps, CalendarMonthsState, CalendarPage } from './types';

defineOptions({ inheritAttrs: false });

defineProps<CalendarMonthsProps>();
defineSlots<{
  /** One month of the page. The months render by their place, so a month part stays when the page moves. */
  month?(scope: { month: CalendarPage; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthsState;
    months: readonly CalendarPage[];
  }): unknown;
}>();

const calendar = injectCalendar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<CalendarMonthsState>(() => ({
  ...calendar.state,
  navigationDirection: calendar.navigationDirection,
}));

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      ...stateAttributes(state.value),
      'data-navigation-direction': state.value.navigationDirection,
    },
    attrs,
  );
}
</script>

<!-- prettier-ignore -->
<template>
  <slot
    v-if="calendar.view === 'day' && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :months="calendar.pages"
  />
  <component :is="as" v-else-if="calendar.view === 'day' && as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(month, index) in calendar.pages" :key="index"><slot name="month" :month="month" :index="index" /></template>
  </component>
  <div v-else-if="calendar.view === 'day'" v-bind="elementProps()" :ref="setElement">
    <template v-for="(month, index) in calendar.pages" :key="index"><slot name="month" :month="month" :index="index" /></template>
  </div>
</template>
