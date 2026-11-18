<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';

const month = shallowRef<Temporal.PlainYearMonth | null>(null);
const kind = Temporal.PlainYearMonth.from('2026-11');
</script>

<template>
  <Calendar.Root
    v-model="month"
    :default-value="kind"
    :disabled-months="(candidate) => candidate.month === 8"
    :disabled-years="(year) => year.year % 2 === 1"
    :visible-years="9"
  />
</template>
