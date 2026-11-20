<script setup lang="ts">
import type { PropType } from 'vue';
import { Calendar } from '../../src/calendar';

// A calendar with a view trigger and a year grid. `Calendar.Months` is in a `<Transition>` whose
// enter and leave take 200 ms. `root` goes to the root.
defineProps({ root: Object as PropType<Record<string, unknown>> });
</script>

<template>
  <Calendar.Root v-bind="root">
    <Calendar.ViewTrigger />
    <Calendar.YearGrid>
      <template #row="{ years }">
        <Calendar.YearGridRow>
          <Calendar.YearCell v-for="year in years" :key="year.year" :year="year" />
        </Calendar.YearGridRow>
      </template>
    </Calendar.YearGrid>
    <Transition name="page">
      <Calendar.Months data-testid="months">
        <template #month="{ month }">
          <Calendar.Month :month="month">
            <Calendar.Caption />
          </Calendar.Month>
        </template>
      </Calendar.Months>
    </Transition>
  </Calendar.Root>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 200ms linear;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
