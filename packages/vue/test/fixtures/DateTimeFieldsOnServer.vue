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

function toValue(text: string | undefined) {
  if (text === undefined) return undefined;
  if (text.includes('[')) return Temporal.ZonedDateTime.from(text);
  if (props.family === 'time' && !text.includes('T')) return Temporal.PlainTime.from(text);
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainDate.from(text);
}
</script>

<template>
  <form>
    <label for="when">When</label>
    <DateField.Root
      v-if="family === 'date'"
      id="when"
      :default-value="toValue(value)"
      :locale="locale"
      :hour-cycle="hourCycle"
      :name="name"
    >
      <DateField.Input />
    </DateField.Root>
    <TimeField.Root
      v-else
      id="when"
      :default-value="toValue(value)"
      :locale="locale"
      :hour-cycle="hourCycle"
      :name="name"
    >
      <TimeField.Input />
    </TimeField.Root>
  </form>
</template>
