<script setup lang="ts">
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
import styles from '../../_index.module.css';

const today = Temporal.PlainDate.from('2026-11-14');
const defaultValue: [Temporal.PlainDate, Temporal.PlainDate] = [
  Temporal.PlainDate.from('2026-11-24'),
  Temporal.PlainDate.from('2026-12-03'),
];
</script>

<template>
  <RangeCalendar.Root
    :class="styles.Root"
    aria-label="Conference dates"
    :number-of-months="2"
    paged-navigation
    :today="today"
    time-zone="UTC"
    locale="en-US"
    :default-value="defaultValue"
  >
    <RangeCalendar.PreviousButton :class="[styles.Navigation, styles.Previous]">
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
    </RangeCalendar.PreviousButton>
    <RangeCalendar.NextButton :class="[styles.Navigation, styles.Next]">
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
    </RangeCalendar.NextButton>
    <RangeCalendar.Months :class="styles.Months">
      <template #month="{ month }">
        <RangeCalendar.Month :month="month" :class="styles.Month">
          <RangeCalendar.Caption :class="styles.Caption" />
          <RangeCalendar.Grid :class="styles.Grid">
            <RangeCalendar.GridHeader>
              <RangeCalendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <RangeCalendar.Weekday :weekday="weekday" :class="styles.Weekday" />
                </template>
              </RangeCalendar.GridHeaderRow>
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              <template #week="{ week }">
                <RangeCalendar.Week :week="week">
                  <template #day="{ day }">
                    <RangeCalendar.Day :day="day" :class="styles.Day">
                      <RangeCalendar.DayButton :class="styles.DayButton" />
                    </RangeCalendar.Day>
                  </template>
                </RangeCalendar.Week>
              </template>
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar.Month>
      </template>
    </RangeCalendar.Months>
  </RangeCalendar.Root>
</template>
