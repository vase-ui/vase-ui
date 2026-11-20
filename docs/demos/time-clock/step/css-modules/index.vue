<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
import styles from '../../_index.module.css';

const time = Temporal.PlainTime.from('09:15');
const minTime = Temporal.PlainTime.from('09:00');
const maxTime = Temporal.PlainTime.from('17:00');
</script>

<template>
  <TimeClock.Root
    :class="styles.Clock"
    aria-label="Appointment time"
    locale="en-US"
    default-view="minute"
    :minute-step="15"
    :min="minTime"
    :max="maxTime"
    :default-value="time"
  >
    <div :class="styles.Header">
      <TimeClock.ViewTrigger view="hour" :class="styles.Trigger" />
      <span aria-hidden="true" :class="styles.Separator">:</span>
      <TimeClock.ViewTrigger view="minute" :class="styles.Trigger" />
      <TimeClock.DayPeriod value="am" :class="styles.DayPeriod" />
      <TimeClock.DayPeriod value="pm" :class="styles.DayPeriod" />
    </div>
    <TimeClock.Face :class="styles.Face">
      <TimeClock.Hand :class="styles.Hand" />
      <template #number="{ number }">
        <TimeClock.Number :number="number" :class="styles.Number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
