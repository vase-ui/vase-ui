<script setup lang="ts">
import type { Component } from 'vue';
import { TimeClock } from '../../src/time-clock';

/** The `as` of each number, a tag or a component. */
withDefaults(defineProps<{ numberAs?: keyof HTMLElementTagNameMap | Component }>(), {
  numberAs: 'b',
});

const time = Temporal.PlainTime.from('15:30');
</script>

<!-- Each part of the clock renders the tag of `as`. -->
<template>
  <TimeClock.Root as="section" :default-value="time" aria-label="Time">
    <TimeClock.ViewTrigger as="span" view="hour" />
    <TimeClock.DayPeriod as="span" value="pm" />
    <TimeClock.Face as="article">
      <TimeClock.Hand as="i" />
      <template #number="{ number }">
        <TimeClock.Number :as="numberAs" :number="number" class="Number" />
      </template>
    </TimeClock.Face>
  </TimeClock.Root>
</template>
