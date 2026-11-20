<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

const selected = shallowRef<Temporal.PlainYearMonth | null>(
  Temporal.PlainYearMonth.from('2026-11'),
);
</script>

<template>
  <Calendar.Root v-model="selected" locale="en-US" :class="styles.Root">
    <div :class="styles.Header">
      <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
      <Calendar.ViewTrigger :class="styles.Title" />
      <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
    </div>
    <Calendar.MonthGrid :class="styles.Rows">
      <template #row="{ months }">
        <Calendar.MonthGridRow :class="styles.Row">
          <Calendar.MonthCell
            v-for="month in months"
            :key="month.toString()"
            :month="month"
            :class="styles.Cell"
          />
        </Calendar.MonthGridRow>
      </template>
    </Calendar.MonthGrid>
    <Calendar.YearGrid :class="styles.Rows">
      <template #row="{ years }">
        <Calendar.YearGridRow :class="styles.Row">
          <Calendar.YearCell
            v-for="year in years"
            :key="year.toString()"
            :year="year"
            :class="styles.Cell"
          />
        </Calendar.YearGridRow>
      </template>
    </Calendar.YearGrid>
  </Calendar.Root>
</template>
