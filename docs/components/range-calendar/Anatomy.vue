<script setup lang="ts">
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
</script>

<template>
  <RangeCalendar.Root>
    <RangeCalendar.PreviousButton />
    <RangeCalendar.NextButton />
    <RangeCalendar.Months>
      <template #month="{ month }">
        <RangeCalendar.Month :month="month">
          <RangeCalendar.Caption />
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              <RangeCalendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <RangeCalendar.Weekday :weekday="weekday" />
                </template>
              </RangeCalendar.GridHeaderRow>
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              <template #week="{ week }">
                <RangeCalendar.Week :week="week">
                  <template #day="{ day }">
                    <RangeCalendar.Day :day="day">
                      <RangeCalendar.DayButton />
                    </RangeCalendar.Day>
                  </template>
                </RangeCalendar.Week>
              </template>
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar.Month>
      </template>
    </RangeCalendar.Months>
    <RangeCalendar.Footer />
  </RangeCalendar.Root>
</template>
