<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPageWeek } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarWeekState extends CalendarState {}

export interface CalendarWeekProps
  extends
    VaseUIComponentProps<CalendarWeekState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The week that the part shows. It is the value of the slot `week` of `Calendar.GridBody`.
   */
  week: CalendarPageWeek;
}
</script>

<script setup lang="ts">
import { toInputText } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarWeekProps>(), { as: 'tr' });

defineSlots<{
  /**
   * The content before the days, such as `Calendar.WeekNumber`. The `#render` slot does not render
   * it.
   */
  default?(): unknown;
  /**
   * Renders one day of the week. The `#render` slot does not render it.
   */
  day(props: { day: Temporal.PlainDate; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarWeekState>;
}>();

const { state } = useCalendarRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('tr', props, { state });

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot /><template v-for="(day, index) in week.days" :key="toInputText(day, false)"><slot name="day" :day="day" :index="index" /></template>
  </component>
</template>
