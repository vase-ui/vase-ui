<script setup lang="ts">
import { formatText } from '../common/date-time/text';
import { injectCalendar } from './root';
import { useCalendarSelect } from './select';
import type {
  CalendarSelectOption,
  CalendarYearSelectProps,
  CalendarYearSelectState,
} from './types';

const YEARS_AROUND_TODAY = 100;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarYearSelectProps>(), {
  format: 'numeric',
  order: 'asc',
});
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarYearSelectState;
    options: readonly CalendarSelectOption[];
    value: string;
  }): unknown;
}>();

const calendar = injectCalendar();
const { element, setElement, state, options, value, elementProps } = useCalendarSelect({
  field: 'year',
  options({ yearMonth }) {
    const { min, max } = calendar.monthLimits;
    // While the root does not know today, the years count from the year of the page.
    const center = calendar.today
      ? calendar.today.withCalendar(yearMonth.calendarId).year
      : yearMonth.year;
    // The year of the page is always an option, also out of the limits.
    const first = Math.min(min?.year ?? center - YEARS_AROUND_TODAY, yearMonth.year);
    const last = Math.max(max?.year ?? center + YEARS_AROUND_TODAY, yearMonth.year);
    const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
    if (props.order === 'desc') years.reverse();
    return years.map((year) => ({
      value: String(year),
      text: formatText(
        Temporal.PlainYearMonth.from({ year, month: 1, calendar: yearMonth.calendarId }),
        { year: props.format },
        calendar.locale,
      ),
      disabled: (!!min && year < min.year) || (!!max && year > max.year),
    }));
  },
  value: ({ yearMonth }) => String(yearMonth.year),
  month: ({ yearMonth }, year) =>
    Temporal.PlainYearMonth.from({
      year: Number(year),
      monthCode: yearMonth.monthCode,
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
