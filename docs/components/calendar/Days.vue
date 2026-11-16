<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';

const days = shallowRef<Temporal.PlainDate[]>([]);
const minDate = Temporal.PlainDate.from('2026-11-01');
const holidays = [Temporal.PlainDate.from('2026-12-25'), Temporal.PlainDate.from('2026-12-26')];
</script>

<template>
  <Calendar.Root
    v-model:value="days"
    multiple
    :max-days="3"
    :min-date="minDate"
    :disabled-dates="{ dayOfWeek: [6, 7] }"
    :unavailable-dates="holidays"
    :modifiers="{ holiday: holidays }"
  />
</template>
