<script setup lang="ts">
import RangeCalendarAnatomy from './RangeCalendarAnatomy.test.vue';

// A server render takes its props as JSON, so each date is a text that this fixture reads.
const props = defineProps<{
  today: string;
  start?: string | undefined;
  end?: string | undefined;
  focusedDate?: string | undefined;
  disabledDate?: string | undefined;
  disabled?: boolean | undefined;
  locale?: string | undefined;
  calendar?: string | undefined;
}>();

const date = (text: string | undefined) =>
  text === undefined ? undefined : Temporal.PlainDate.from(text);
const range = () =>
  props.start === undefined && props.end === undefined
    ? undefined
    : ([date(props.start) ?? null, date(props.end) ?? null] as const);
</script>

<template>
  <RangeCalendarAnatomy
    :today="date(props.today)"
    :value="range()"
    :focused-date="date(props.focusedDate)"
    :disabled-dates="date(props.disabledDate)"
    :disabled="props.disabled"
    :locale="props.locale"
    :calendar="props.calendar"
  />
</template>
