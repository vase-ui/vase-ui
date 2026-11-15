<script setup lang="ts">
import { TimeClock } from '../index';

// The props of a server render go to Node as JSON, so the time is text.
const props = defineProps<{
  time?: string | null;
  locale?: string;
  hourCycle?: 12 | 24;
  view?: 'hour' | 'minute' | 'second';
}>();

const defaultValue = props.time ? Temporal.PlainTime.from(props.time) : null;
</script>

<template>
  <TimeClock.Root
    aria-label="Start time"
    :default-value="defaultValue"
    :default-view="view"
    :hour-cycle="hourCycle"
    :locale="locale"
  >
    <TimeClock.ViewTrigger view="hour" />
    <TimeClock.ViewTrigger view="minute" />
    <TimeClock.DayPeriod value="am" />
    <TimeClock.DayPeriod value="pm" />
    <TimeClock.Face>
      <TimeClock.Hand />
      <template #number="{ number }">
        <TimeClock.Number :number="number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
