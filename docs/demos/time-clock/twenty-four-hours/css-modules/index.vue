<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
import styles from '../../_index.module.css';

const time = Temporal.PlainTime.from('15:00');
</script>

<template>
  <TimeClock.Root
    :class="styles.Clock"
    aria-label="Meeting time"
    locale="en-US"
    :hour-cycle="24"
    :default-value="time"
  >
    <div :class="styles.Header">
      <TimeClock.ViewTrigger view="hour" :class="styles.Trigger" />
      <span aria-hidden="true" :class="styles.Separator">:</span>
      <TimeClock.ViewTrigger view="minute" :class="styles.Trigger" />
    </div>
    <TimeClock.Face :class="styles.Face">
      <TimeClock.Hand :class="styles.Hand" />
      <template #number="{ number }">
        <TimeClock.Number :number="number" :class="styles.Number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
