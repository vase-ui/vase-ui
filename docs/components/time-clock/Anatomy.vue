<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';
</script>

<template>
  <TimeClock.Root>
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
