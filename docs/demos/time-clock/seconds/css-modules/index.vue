<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
import styles from '../../_index.module.css';

const time = Temporal.PlainTime.from('10:30:45');
</script>

<template>
  <TimeClock.Root
    :class="styles.Clock"
    aria-label="Timer"
    locale="en-US"
    granularity="second"
    :hour-cycle="24"
    :default-value="time"
  >
    <div :class="styles.Header">
      <TimeClock.ViewTrigger view="hour" :class="styles.Trigger" />
      <span aria-hidden="true" :class="styles.Separator">:</span>
      <TimeClock.ViewTrigger view="minute" :class="styles.Trigger" />
      <span aria-hidden="true" :class="styles.Separator">:</span>
      <TimeClock.ViewTrigger view="second" :class="styles.Trigger" />
    </div>
    <TimeClock.Face :class="styles.Face">
      <TimeClock.Hand :class="styles.Hand" />
      <template #number="{ number }">
        <TimeClock.Number :number="number" :class="styles.Number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
