<script setup lang="ts">
import type { PropType } from 'vue';
import { Calendar } from '../../src/calendar';

// A caption with no root, a grid with no month, or a day button with no day.
defineProps({
  part: { type: String as PropType<'caption' | 'grid' | 'day-button'>, required: true },
});
const today = Temporal.PlainDate.from('2026-11-18');
</script>

<template>
  <Calendar.Caption v-if="part === 'caption'" />
  <Calendar.Root v-else :today="today">
    <Calendar.Grid v-if="part === 'grid'" />
    <Calendar.Months v-else>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.DayButton />
        </Calendar.Month>
      </template>
    </Calendar.Months>
  </Calendar.Root>
</template>
