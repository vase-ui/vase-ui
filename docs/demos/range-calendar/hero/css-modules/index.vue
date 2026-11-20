<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
import styles from '../../_index.module.css';

const defaultValue: [Temporal.PlainDate, Temporal.PlainDate] = [
  Temporal.PlainDate.from('2026-11-10'),
  Temporal.PlainDate.from('2026-11-14'),
];
</script>

<template>
  <RangeCalendar.Root
    :class="styles.Root"
    aria-label="Trip dates"
    locale="en-US"
    :default-value="defaultValue"
  >
    <Calendar.PreviousButton :class="[styles.Navigation, styles.Previous]">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 3 5 8l5 5" />
      </svg>
    </Calendar.PreviousButton>
    <Calendar.NextButton :class="[styles.Navigation, styles.Next]">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m6 3 5 5-5 5" />
      </svg>
    </Calendar.NextButton>
    <Calendar.Months :class="styles.Months">
      <template #month="{ month }">
        <Calendar.Month :month="month" :class="styles.Month">
          <Calendar.Caption :class="styles.Caption" />
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
  </RangeCalendar.Root>
</template>
