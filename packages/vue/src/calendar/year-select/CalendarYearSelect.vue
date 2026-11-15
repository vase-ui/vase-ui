<script lang="ts">
import type { Component, SelectHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarYearSelectState extends CalendarState {}

export interface CalendarYearSelectProps
  extends
    VaseUIComponentProps<CalendarYearSelectState>,
    /* @vue-ignore */ WithVaseUIEvent<SelectHTMLAttributes> {
  /**
   * The format of a year in the options.
   * @default 'numeric'
   */
  format?: 'numeric' | '2-digit' | undefined;
  /**
   * The order of the years in the options. The years run from the year of `minDate` to the year of
   * `maxDate`. A limit that the calendar does not have is 100 years from today.
   * @default 'asc'
   */
  order?: 'asc' | 'desc' | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { formatFieldName, formatText } from '../../internals/date-time/calendar/formatText';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { useCalendarSelect } from '../utils/useCalendarSelect';
import CalendarYearSelectChildren from './CalendarYearSelectChildren.vue';

defineOptions({ inheritAttrs: false });

const YEARS_AROUND_TODAY = 100;

const props = withDefaults(defineProps<CalendarYearSelectProps>(), {
  as: 'select',
  format: 'numeric',
  order: 'asc',
});

defineSlots<{
  render(props: { props: HTMLProps; state: CalendarYearSelectState; children: Component }): unknown;
}>();

const root = useCalendarRootContext();
const { state, locale } = root;

const { onChange } = useCalendarSelect({
  root,
  getOptions({ yearMonth }) {
    const { minDate, maxDate, today } = root.rules.value;
    const todayYear = root.toGridDate(today).year;
    const minYear = minDate ? root.toGridDate(minDate).year : todayYear - YEARS_AROUND_TODAY;
    const maxYear = maxDate ? root.toGridDate(maxDate).year : todayYear + YEARS_AROUND_TODAY;
    // The year that the calendar shows is always an option, also when it is out of the limits.
    const first = Math.min(minYear, yearMonth.year);
    const last = Math.max(maxYear, yearMonth.year);
    const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
    if (props.order === 'desc') {
      years.reverse();
    }
    return years.map((year) => ({
      value: String(year),
      text: formatText(
        Temporal.PlainYearMonth.from({ year, month: 1, calendar: yearMonth.calendarId }),
        { year: props.format },
        locale.value,
      ),
      disabled: year < minYear || year > maxYear,
    }));
  },
  getValue: ({ yearMonth }) => String(yearMonth.year),
  getMonth: ({ yearMonth }, value) =>
    Temporal.PlainYearMonth.from({
      year: Number(value),
      monthCode: yearMonth.monthCode,
      calendar: yearMonth.calendarId,
    }),
});

const label = computed(() => formatFieldName('year', locale.value));

const { element, elementProps } = useRenderElement('select', props, {
  state,
  children: true,
  props: (attrs) => [
    {
      'aria-label': label.value,
      disabled: state.value.disabled ? true : undefined,
      onChange,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.render"
    name="render"
    :props="elementProps()"
    :state="state"
    :children="CalendarYearSelectChildren"
  />
  <component :is="as" v-else v-bind="elementProps()"><CalendarYearSelectChildren /></component>
</template>
