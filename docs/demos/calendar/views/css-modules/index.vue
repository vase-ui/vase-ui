<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';
</script>

<template>
  <Calendar.Root locale="en-US" :class="[styles.Root, styles.SixWeeks]">
    <div :class="styles.Header">
      <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
      <Calendar.ViewTrigger
        aria-description="Shows the years, or the days again"
        :class="styles.Title"
      />
      <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
    </div>
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Grid :class="styles.Grid">
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" :class="styles.Weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <template #day="{ day }">
                    <Calendar.Day :day="day" :class="styles.Day">
                      <Calendar.DayButton :class="styles.DayButton" />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      </template>
    </Calendar.Months>
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
