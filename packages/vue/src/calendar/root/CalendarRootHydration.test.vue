<script setup lang="ts">
import CalendarAnatomy from './CalendarAnatomy.test.vue';

// A server render takes its props as JSON, so each date is a text that this fixture reads.
const props = defineProps<{
  today: string;
  value?: string | undefined;
  focusedDate?: string | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  disabledDate?: string | undefined;
  multiple?: boolean | undefined;
  disabled?: boolean | undefined;
  locale?: string | undefined;
  calendar?: string | undefined;
  firstDayOfWeek?: number | undefined;
}>();

const date = (text: string | undefined) =>
  text === undefined ? undefined : Temporal.PlainDate.from(text);
const dates = (text: string | undefined) =>
  text === undefined ? undefined : text.split(',').map((item) => Temporal.PlainDate.from(item));
</script>

<template>
  <CalendarAnatomy
    :today="date(props.today)"
    :value="props.multiple ? dates(props.value) : date(props.value)"
    :focused-date="date(props.focusedDate)"
    :min-date="date(props.minDate)"
    :max-date="date(props.maxDate)"
    :disabled-dates="date(props.disabledDate)"
    :multiple="props.multiple"
    :disabled="props.disabled"
    :locale="props.locale"
    :calendar="props.calendar"
    :first-day-of-week="props.firstDayOfWeek"
  />
</template>
