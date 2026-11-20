<script setup lang="ts">
import { DateField } from '../../src/date-field';
import { TimeField } from '../../src/time-field';

// The props of a server render go to Node as JSON, so a value is a text.
const props = defineProps<{
  family: 'date' | 'time';
  locale?: string | undefined;
  value?: string | undefined;
  hourCycle?: 12 | 24 | undefined;
  name?: string | undefined;
}>();

function dateTime(text: string) {
  return text.includes('[') ? Temporal.ZonedDateTime.from(text) : Temporal.PlainDateTime.from(text);
}

const text = props.value;
function parse(family: 'date' | 'time') {
  if (text === undefined || props.family !== family) return undefined;
  if (text.includes('T')) return dateTime(text);
  return family === 'date' ? Temporal.PlainDate.from(text) : Temporal.PlainTime.from(text);
}
const date = parse('date') as
  Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | undefined;
const time = parse('time') as
  Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime | undefined;
</script>

<template>
  <form>
    <label for="when">When</label>
    <DateField.Root
      v-if="family === 'date'"
      id="when"
      :default-value="date"
      :locale="locale"
      :hour-cycle="hourCycle"
      :name="name"
    >
      <DateField.Input />
    </DateField.Root>
    <TimeField.Root
      v-else
      id="when"
      :default-value="time"
      :locale="locale"
      :hour-cycle="hourCycle"
      :name="name"
    >
      <TimeField.Input />
    </TimeField.Root>
  </form>
</template>
