<script setup lang="ts">
import CalendarViewsAnatomy from './CalendarViewsAnatomy.test.vue';

// A server render takes its props as JSON, so each date is a text that this fixture reads. A year
// and month has no day, as in `2026-11`.
const props = defineProps<{
  today: string;
  value?: string | undefined;
  view?: 'day' | 'month' | 'year' | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  locale?: string | undefined;
  calendar?: string | undefined;
  columns?: number | undefined;
  disabled?: boolean | undefined;
}>();

const date = (text: string | undefined) =>
  text === undefined ? undefined : Temporal.PlainDate.from(text);
const parseValue = (text: string | undefined) =>
  text?.length === 7 ? Temporal.PlainYearMonth.from(text) : date(text);
</script>

<template>
  <CalendarViewsAnatomy
    :today="date(props.today)"
    :value="parseValue(props.value)"
    :view="props.view"
    :min-date="date(props.minDate)"
    :max-date="date(props.maxDate)"
    :locale="props.locale"
    :calendar="props.calendar"
    :columns="props.columns"
    :disabled="props.disabled"
  />
</template>
