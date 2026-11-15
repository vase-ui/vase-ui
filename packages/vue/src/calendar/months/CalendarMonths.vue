<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarRootState } from '../root/CalendarRoot.vue';

export interface CalendarMonthsState extends CalendarRootState {}

export interface CalendarMonthsProps
  extends
    VaseUIComponentProps<CalendarMonthsState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthsProps>(), { as: 'div' });

defineSlots<{
  /**
   * Renders one month of the calendar. The `#render` slot does not render it.
   */
  month(props: { month: CalendarPage; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthsState>;
}>();

const { state, pages } = useCalendarRootContext();

const { element, elementProps } = useRenderElement('div', props, { state });

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><template v-for="(month, index) in pages" :key="month.yearMonth.toString()"><slot name="month" :month="month" :index="index" /></template></component>
</template>
