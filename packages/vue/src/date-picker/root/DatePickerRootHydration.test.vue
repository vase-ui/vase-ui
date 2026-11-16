<script setup lang="ts">
import DatePickerAnatomy from './DatePickerAnatomy.test.vue';

// The props of a server render go to Node as JSON, so a value is a text. The form of the text gives
// the kind of the value.
const props = defineProps<{
  today: string;
  value?: string | undefined;
  granularity?: 'month' | 'day' | 'hour' | 'minute' | 'second' | undefined;
  locale?: string | undefined;
  calendar?: string | undefined;
  timeZone?: string | undefined;
  name?: string | undefined;
  disabled?: boolean | undefined;
  open?: boolean | undefined;
  timeField?: boolean | undefined;
  monthGrid?: boolean | undefined;
}>();

// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const today = Temporal.PlainDate.from(props.today);

function toValue(text: string | undefined) {
  if (text === undefined) {
    return undefined;
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    return Temporal.PlainYearMonth.from(text);
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainDate.from(text);
}
</script>

<template>
  <DatePickerAnatomy
    :default-value="toValue(props.value)"
    :granularity="props.granularity"
    :locale="props.locale"
    :calendar="props.calendar"
    :time-zone="props.timeZone"
    :name="props.name"
    :disabled="props.disabled"
    :default-open="props.open"
    :time-field="props.timeField"
    :month-grid="props.monthGrid"
    :calendar-props="{ today }"
  />
</template>
