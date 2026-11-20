<script setup lang="ts">
import { Calendar } from '../../src/calendar';

// The parts of Calendar in a picker calendar: the buttons of the page, and one grid of days, or of
// months with `months`. Each day cell has `data-date`, and each month cell `data-month`.
defineProps({ months: Boolean });
</script>

<template>
  <Calendar.PreviousButton />
  <Calendar.NextButton />
  <Calendar.MonthGrid v-if="months">
    <template #row="{ months: cells }">
      <Calendar.MonthGridRow>
        <Calendar.MonthCell
          v-for="month in cells"
          :key="month.toString()"
          :month="month"
          :data-month="month.toString()"
        />
      </Calendar.MonthGridRow>
    </template>
  </Calendar.MonthGrid>
  <Calendar.Months v-else>
    <template #month="{ month }">
      <Calendar.Month :month="month">
        <Calendar.Caption />
        <Calendar.Grid>
          <Calendar.GridBody>
            <template #week="{ week }">
              <Calendar.Week :week="week">
                <template #day="{ day }">
                  <Calendar.Day :day="day" :data-date="day.withCalendar('iso8601').toString()">
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
</template>
