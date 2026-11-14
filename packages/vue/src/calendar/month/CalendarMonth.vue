<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarRootState } from '../root/CalendarRoot.vue';

export interface CalendarMonthState extends CalendarRootState {
  /**
   * The position of the month in the months of the calendar, from `0`.
   */
  index: number;
}

export interface CalendarMonthProps
  extends
    VaseUIComponentProps<CalendarMonthState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The month that the part shows. It is the value of the slot `month` of `Calendar.Months`.
   */
  month: CalendarPage;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { formatText } from '../../internals/date-time/calendar/formatText';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { CalendarMonthContext } from './CalendarMonthContext';
import * as CalendarMonthDataAttributes from './CalendarMonthDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CalendarMonthState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarMonthState>;
}>();

const { state: rootState, pages, locale } = useCalendarRootContext();

const month = computed(() => props.month);

const state = computed<CalendarMonthState>(() => ({
  ...rootState.value,
  index: pages.value.findIndex((page) => page.yearMonth.equals(props.month.yearMonth)),
}));

provide(CalendarMonthContext, {
  month,
  text: computed(() =>
    formatText(props.month.yearMonth, { month: 'long', year: 'numeric' }, locale.value),
  ),
});

// The default mapping leaves out the index `0`.
const stateAttributesMapping: StateAttributesMapping<CalendarMonthState> = {
  index: (value) => ({ [CalendarMonthDataAttributes.index]: String(value) }),
};

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
