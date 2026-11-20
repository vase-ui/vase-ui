<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';

const today = Temporal.PlainDate.from('2026-11-14');
const selectedDay = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-10'));
const selectedMonth = shallowRef<Temporal.PlainYearMonth | null>(
  Temporal.PlainYearMonth.from('2026-03'),
);
</script>

<template>
  <main>
    <Calendar.Root v-model="selectedDay" :today="today" locale="en-US" data-testid="days">
      <Calendar.PreviousButton />
      <Calendar.ViewTrigger data-testid="days-year" />
      <Calendar.NextButton />
      <Calendar.Months>
        <template #month="{ month }">
          <Calendar.Month :month="month">
            <Calendar.Grid>
              <Calendar.GridBody>
                <template #week="{ week }">
                  <Calendar.Week :week="week">
                    <template #day="{ day }">
                      <Calendar.Day :day="day" :data-date="day.toString()"
                        ><Calendar.DayButton
                      /></Calendar.Day>
                    </template>
                  </Calendar.Week>
                </template>
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar.Month>
        </template>
      </Calendar.Months>
      <Calendar.MonthGrid>
        <template #row="{ months }">
          <Calendar.MonthGridRow>
            <Calendar.MonthCell v-for="month in months" :key="month.toString()" :month="month" />
          </Calendar.MonthGridRow>
        </template>
      </Calendar.MonthGrid>
      <Calendar.YearGrid>
        <template #row="{ years }">
          <Calendar.YearGridRow>
            <Calendar.YearCell v-for="year in years" :key="year.toString()" :year="year" />
          </Calendar.YearGridRow>
        </template>
      </Calendar.YearGrid>
    </Calendar.Root>
    <output data-testid="day-value">{{ selectedDay?.toString() ?? '' }}</output>
    <Calendar.Root v-model="selectedMonth" :today="today" locale="en-US" data-testid="months">
      <Calendar.ViewTrigger data-testid="months-year" />
      <Calendar.MonthGrid>
        <template #row="{ months }">
          <Calendar.MonthGridRow>
            <Calendar.MonthCell v-for="month in months" :key="month.toString()" :month="month" />
          </Calendar.MonthGridRow>
        </template>
      </Calendar.MonthGrid>
      <Calendar.YearGrid>
        <template #row="{ years }">
          <Calendar.YearGridRow>
            <Calendar.YearCell v-for="year in years" :key="year.toString()" :year="year" />
          </Calendar.YearGridRow>
        </template>
      </Calendar.YearGrid>
    </Calendar.Root>
    <output data-testid="month-value">{{ selectedMonth?.toString() ?? '' }}</output>
  </main>
</template>
