<script setup lang="ts">
import DateRangePickerAnatomy from './DateRangePickerAnatomy.test.vue';

// The props of a server render go to Node as JSON, so an end is a text. The form of the text gives
// the kind of the end.
const props = defineProps<{
  today: string;
  value?: [string | null, string | null] | undefined;
  granularity?: 'day' | 'hour' | 'minute' | 'second' | undefined;
  locale?: string | undefined;
  calendar?: string | undefined;
  timeZone?: string | undefined;
  startName?: string | undefined;
  endName?: string | undefined;
  disabled?: boolean | undefined;
  open?: boolean | undefined;
}>();

// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const today = Temporal.PlainDate.from(props.today);

function toEnd(text: string | null) {
  if (text === null) {
    return null;
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainDate.from(text);
}

const defaultValue = props.value && [toEnd(props.value[0]), toEnd(props.value[1])];
</script>

<template>
  <DateRangePickerAnatomy
    :default-value="defaultValue"
    :granularity="props.granularity"
    :locale="props.locale"
    :calendar="props.calendar"
    :time-zone="props.timeZone"
    :start-name="props.startName"
    :end-name="props.endName"
    :disabled="props.disabled"
    :default-open="props.open"
    :calendar-props="{ today }"
  />
</template>
