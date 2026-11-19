<script setup lang="ts">
import { Field } from '../../field';
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
  // The text of the label of a `Field` around the picker, and where the label is.
  label?: string | undefined;
  labelAfter?: boolean | undefined;
}>();

// A template reads only the globals that Vue lists, and `Temporal` is not one of them.
const todayDate = Temporal.PlainDate.from(props.today);

function toEnd(text: string | null) {
  if (text === null) {
    return null;
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainDate.from(text);
}

const anatomyProps = {
  defaultValue: props.value && [toEnd(props.value[0]), toEnd(props.value[1])],
  granularity: props.granularity,
  locale: props.locale,
  calendar: props.calendar,
  timeZone: props.timeZone,
  startName: props.startName,
  endName: props.endName,
  disabled: props.disabled,
  defaultOpen: props.open,
  calendarProps: { today: todayDate },
};
</script>

<template>
  <Field.Root v-if="props.label !== undefined">
    <Field.Label v-if="!props.labelAfter">{{ props.label }}</Field.Label>
    <DateRangePickerAnatomy v-bind="anatomyProps" />
    <Field.Label v-if="props.labelAfter">{{ props.label }}</Field.Label>
  </Field.Root>
  <DateRangePickerAnatomy v-else v-bind="anatomyProps" />
</template>
