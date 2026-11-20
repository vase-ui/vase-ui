<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
</script>

<template>
  <RangeCalendar.Root>
    <Calendar.PreviousButton />
    <Calendar.NextButton />
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Caption />
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
    <Calendar.Footer />
  </RangeCalendar.Root>
</template>
