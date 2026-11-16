<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
</script>

<template>
  <Calendar.Root>
    <Calendar.PreviousButton />
    <Calendar.ViewTrigger />
    <Calendar.NextButton />
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Caption />
          <Calendar.MonthSelect />
          <Calendar.YearSelect />
          <Calendar.Grid>
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <Calendar.WeekNumberHeader />
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <Calendar.WeekNumber :week="week" />
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
    <Calendar.Footer />
  </Calendar.Root>
</template>
