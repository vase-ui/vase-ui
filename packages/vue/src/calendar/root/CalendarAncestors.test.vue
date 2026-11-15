<script setup lang="ts">
import * as Calendar from '../index.parts';

// The part under test is the default slot. `root` puts it in a root, `month` in a month and `day`
// in a day.
defineProps<{ level: 'root' | 'month' | 'day' }>();

const today = Temporal.PlainDate.from('2026-11-14');
const day = Temporal.PlainDate.from('2026-11-11');
</script>

<template>
  <Calendar.Root :today="today" locale="en-US">
    <slot v-if="level === 'root'" />
    <Calendar.Months v-else>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <slot v-if="level === 'month'" />
          <Calendar.Day v-else :day="day"><slot /></Calendar.Day>
        </Calendar.Month>
      </template>
    </Calendar.Months>
  </Calendar.Root>
</template>
