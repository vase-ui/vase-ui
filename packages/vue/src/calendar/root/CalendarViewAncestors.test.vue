<script setup lang="ts">
import * as Calendar from '../index.parts';

// The part under test is the default slot. `root` puts it in a root, `grid` in the grid of the view,
// and `row` in the first row of that grid.
defineProps<{ view: 'month' | 'year'; level: 'root' | 'grid' | 'row' }>();

const today = Temporal.PlainDate.from('2026-11-14');
</script>

<template>
  <Calendar.Root :today="today" :view="view" locale="en-US">
    <slot v-if="level === 'root'" />
    <Calendar.MonthGrid v-else-if="view === 'month'">
      <template #row="{ index }">
        <template v-if="index === 0">
          <slot v-if="level === 'grid'" />
          <Calendar.MonthGridRow v-else><slot /></Calendar.MonthGridRow>
        </template>
      </template>
    </Calendar.MonthGrid>
    <Calendar.YearGrid v-else>
      <template #row="{ index }">
        <template v-if="index === 0">
          <slot v-if="level === 'grid'" />
          <Calendar.YearGridRow v-else><slot /></Calendar.YearGridRow>
        </template>
      </template>
    </Calendar.YearGrid>
  </Calendar.Root>
</template>
