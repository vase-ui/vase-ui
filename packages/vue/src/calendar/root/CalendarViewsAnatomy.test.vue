<script setup lang="ts">
import { shallowRef } from 'vue';
import * as Calendar from '../index.parts';

defineOptions({ inheritAttrs: false });

// `columns` is the count of cells in a row of the two grids.
withDefaults(defineProps<{ columns?: number }>(), { columns: 3 });

// The root exposes `focus`. A test reads it through `root`.
const root = shallowRef<{ focus: (date?: Temporal.PlainDate) => void } | null>(null);

defineExpose({ root });
</script>

<template>
  <Calendar.Root ref="root" v-bind="$attrs">
    <Calendar.PreviousButton data-testid="previous" />
    <Calendar.ViewTrigger data-testid="year-trigger" />
    <Calendar.ViewTrigger view="month" data-testid="month-trigger" />
    <Calendar.NextButton data-testid="next" />
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Grid>
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <template #day="{ day }">
                    <Calendar.Day :day="day">
                      <Calendar.DayButton />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      </template>
    </Calendar.Months>
    <Calendar.MonthGrid :columns="columns">
      <template #row="{ months }">
        <Calendar.MonthGridRow>
          <Calendar.MonthCell v-for="month in months" :key="month.toString()" :month="month" />
        </Calendar.MonthGridRow>
      </template>
    </Calendar.MonthGrid>
    <Calendar.YearGrid :columns="columns">
      <template #row="{ years }">
        <Calendar.YearGridRow>
          <Calendar.YearCell v-for="year in years" :key="year.toString()" :year="year" />
        </Calendar.YearGridRow>
      </template>
    </Calendar.YearGrid>
  </Calendar.Root>
</template>
