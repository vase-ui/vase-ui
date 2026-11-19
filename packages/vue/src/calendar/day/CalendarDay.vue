<script lang="ts">
import type { TdHTMLAttributes } from 'vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface CalendarDayState extends DayState {}

export interface CalendarDayProps
  extends
    VaseUIComponentProps<CalendarDayState>,
    /* @vue-ignore */ WithVaseUIEvent<TdHTMLAttributes> {
  /**
   * The day that the part shows. It is the value of the slot `day` of `Calendar.Week`.
   */
  day: Temporal.PlainDate;
}
</script>

<script setup lang="ts">
import { computed, provide, toRef } from 'vue';
import { getDayState } from '../../internals/date-time/calendar/dayState';
import { toInputText } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import {
  useCalendarRootContext,
  CalendarDayContext,
  dayStateAttributesMapping,
} from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarDayProps>(), { as: 'td' });

defineSlots<{
  default(props: { state: CalendarDayState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarDayState>;
}>();

const { rules } = useCalendarRootContext();
const { month } = useCalendarMonthContext();

const state = computed<CalendarDayState>(() => getDayState(props.day, month.value, rules.value));

provide(CalendarDayContext, { day: toRef(() => props.day), state });

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
  stateAttributesMapping: dayStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
