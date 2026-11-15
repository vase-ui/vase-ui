<script lang="ts">
import type { Component, SelectHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarMonthSelectState extends CalendarState {}

export interface CalendarMonthSelectProps
  extends
    VaseUIComponentProps<CalendarMonthSelectState>,
    /* @vue-ignore */ WithVaseUIEvent<SelectHTMLAttributes> {
  /**
   * The format of the name of a month in the options.
   * @default 'long'
   */
  format?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit' | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { formatFieldName, formatText } from '../../internals/date-time/calendar/formatText';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { useCalendarSelect } from '../utils/useCalendarSelect';
import CalendarMonthSelectChildren from './CalendarMonthSelectChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthSelectProps>(), {
  as: 'select',
  format: 'long',
});

defineSlots<{
  render(props: {
    props: HTMLProps;
    state: CalendarMonthSelectState;
    children: Component;
  }): unknown;
}>();

const root = useCalendarRootContext();
const { state, locale } = root;

const { onChange } = useCalendarSelect({
  root,
  getSelect: () => element.value,
  getOptions({ yearMonth }) {
    const { minDate, maxDate } = root.rules.value;
    const min = minDate && root.toGridDate(minDate).toPlainYearMonth();
    const max = maxDate && root.toGridDate(maxDate).toPlainYearMonth();
    return Array.from({ length: yearMonth.monthsInYear }, (_, index) => {
      const month = Temporal.PlainYearMonth.from({
        year: yearMonth.year,
        month: index + 1,
        calendar: yearMonth.calendarId,
      });
      return {
        value: month.monthCode,
        text: formatText(month, { month: props.format }, locale.value),
        disabled:
          (min !== undefined && Temporal.PlainYearMonth.compare(month, min) < 0) ||
          (max !== undefined && Temporal.PlainYearMonth.compare(month, max) > 0),
      };
    });
  },
  getValue: ({ yearMonth }) => yearMonth.monthCode,
  getMonth: ({ yearMonth }, value) =>
    Temporal.PlainYearMonth.from({
      year: yearMonth.year,
      monthCode: value,
      calendar: yearMonth.calendarId,
    }),
});

const label = computed(() => formatFieldName('month', locale.value));

const { element, elementProps } = useRenderElement<CalendarState, HTMLSelectElement>(
  'select',
  props,
  {
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
  },
);

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.render"
    name="render"
    :props="elementProps()"
    :state="state"
    :children="CalendarMonthSelectChildren"
  />
  <component :is="as" v-else v-bind="elementProps()"><CalendarMonthSelectChildren /></component>
</template>
