<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPageWeek } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarRootState } from '../root/CalendarRoot.vue';

export interface CalendarGridBodyState extends CalendarRootState {}

export interface CalendarGridBodyProps
  extends
    VaseUIComponentProps<CalendarGridBodyState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { toInputText } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarGridBodyProps>(), { as: 'tbody' });

defineSlots<{
  /**
   * Renders one week of the month. The `#render` slot does not render it.
   */
  week(props: { week: CalendarPageWeek; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarGridBodyState>;
}>();

const { state } = useCalendarRootContext();
const { month } = useCalendarMonthContext();

const { element, elementProps } = useRenderElement('tbody', props, { state });

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><template v-for="(week, index) in month.weeks" :key="toInputText(week.start, false)"><slot name="week" :week="week" :index="index" /></template></component>
</template>
