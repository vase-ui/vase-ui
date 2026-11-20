<script setup lang="ts">
import { TimeClock } from '../../src/time-clock';

// The props of a server render go to Node as JSON, so a value is a text.
const props = defineProps<{
  locale?: string | undefined;
  value?: string | undefined;
  hourCycle?: 12 | 24 | undefined;
  /** The parts with text render content of the developer. */
  content?: boolean | undefined;
}>();

const value = props.value === undefined ? undefined : Temporal.PlainTime.from(props.value);
</script>

<template>
  <TimeClock.Root :default-value="value" :locale="locale" :hour-cycle="hourCycle">
    <template v-if="content">
      <TimeClock.ViewTrigger view="hour">Hour</TimeClock.ViewTrigger>
      <TimeClock.DayPeriod value="am">Morning</TimeClock.DayPeriod>
    </template>
    <template v-else>
      <TimeClock.ViewTrigger view="hour" />
      <TimeClock.DayPeriod value="am" />
    </template>
    <TimeClock.Face>
      <TimeClock.Hand />
      <template #number="{ number }">
        <TimeClock.Number v-if="content" :number="number">{{ number.value }}</TimeClock.Number>
        <TimeClock.Number v-else :number="number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
