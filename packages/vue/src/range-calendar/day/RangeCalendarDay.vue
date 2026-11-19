<script lang="ts">
import type { TdHTMLAttributes } from 'vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import type { RangeDayState } from '../root/RangeCalendarRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface RangeCalendarDayState extends DayState, RangeDayState {}

export interface RangeCalendarDayProps
  extends
    VaseUIComponentProps<RangeCalendarDayState>,
    /* @vue-ignore */ WithVaseUIEvent<TdHTMLAttributes> {
  /**
   * The day that the part shows. It is the value of the slot `day` of `RangeCalendar.Week`.
   */
  day: Temporal.PlainDate;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { getDayState } from '../../internals/date-time/calendar/dayState';
import { getRangeDayState, useRangeCalendarRootContext } from '../root/RangeCalendarRootContext';
import { toInputText } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarMonthContext } from '../../calendar/month/CalendarMonthContext';
import { useCalendarRootContext } from '../../calendar/root/CalendarRootContext';
import { RangeCalendarDayContext } from './RangeCalendarDayContext';
import { rangeDayStateAttributesMapping } from './stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RangeCalendarDayProps>(), { as: 'td' });

defineSlots<{
  default(props: { state: RangeCalendarDayState }): unknown;
  render: ComponentRenderFn<HTMLProps, RangeCalendarDayState>;
}>();

const { rules } = useCalendarRootContext();
const { month } = useCalendarMonthContext();
const { displayRange } = useRangeCalendarRootContext();

const state = computed<RangeCalendarDayState>(() => {
  const dayState = getDayState(props.day, month.value, rules.value);
  return {
    ...dayState,
    ...getRangeDayState(props.day, displayRange.value, dayState.disabled || dayState.unavailable),
  };
});

provide(RangeCalendarDayContext, { day: computed(() => props.day), state });

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('td', props, {
  state,
  props: (attrs) => [
    {
      role: 'gridcell',
      'aria-selected': state.value.hidden ? undefined : state.value.selected,
      'aria-disabled': state.value.disabled || state.value.unavailable ? true : undefined,
      'data-date': toInputText(props.day, false),
    },
    attrs,
  ],
  stateAttributesMapping: rangeDayStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
