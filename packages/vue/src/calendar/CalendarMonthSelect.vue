<script setup lang="ts">
import { formatText } from '../common/date-time/text';
import { getMonthCells } from './pages';
import { injectCalendar } from './root';
import { useCalendarSelect } from './select';
import type {
  CalendarMonthSelectProps,
  CalendarMonthSelectState,
  CalendarSelectOption,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarMonthSelectProps>(), { format: 'long' });
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarMonthSelectState;
    options: readonly CalendarSelectOption[];
    value: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const { element, setElement, state, options, value, elementProps } = useCalendarSelect({
  field: 'month',
  options({ yearMonth }) {
    const { min, max } = calendar.monthLimits;
    return getMonthCells(yearMonth).map((month) => ({
      value: month.monthCode,
      text: formatText(month, { month: props.format }, calendar.locale),
      disabled:
        (!!min && Temporal.PlainYearMonth.compare(month, min) < 0) ||
        (!!max && Temporal.PlainYearMonth.compare(month, max) > 0),
    }));
  },
  value: ({ yearMonth }) => yearMonth.monthCode,
  month: ({ yearMonth }, monthCode) =>
    Temporal.PlainYearMonth.from({
      year: yearMonth.year,
      monthCode,
      calendar: yearMonth.calendarId,
    }),
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :options="options"
    :value="value"
  />
  <select v-else v-bind="elementProps()" :ref="setElement">
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :selected="option.value === value"
      :disabled="option.disabled"
    >
      {{ option.text }}
    </option>
  </select>
</template>
