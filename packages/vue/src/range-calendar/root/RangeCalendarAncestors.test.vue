<script setup lang="ts">
import * as RangeCalendar from '../index.parts';

// The part under test is the default slot. `root` puts it in a root, `month` in a month and `day`
// in a day.
defineProps<{ level: 'root' | 'month' | 'day' }>();

const today = Temporal.PlainDate.from('2026-11-14');
const day = Temporal.PlainDate.from('2026-11-11');
</script>

<template>
  <RangeCalendar.Root :today="today" locale="en-US">
    <slot v-if="level === 'root'" />
    <RangeCalendar.Months v-else>
      <template #month="{ month }">
        <RangeCalendar.Month :month="month">
          <slot v-if="level === 'month'" />
          <RangeCalendar.Day v-else :day="day"><slot /></RangeCalendar.Day>
        </RangeCalendar.Month>
      </template>
    </RangeCalendar.Months>
  </RangeCalendar.Root>
</template>
