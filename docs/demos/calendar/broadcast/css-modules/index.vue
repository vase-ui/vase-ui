<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

const selected = shallowRef<Temporal.PlainDate | null>(null);
</script>

<template>
  <Calendar.Root
    v-model="selected"
    broadcast-calendar
    :first-week-contains-date="1"
    locale="en-US"
    aria-label="Air date"
    :class="[styles.Root, styles.SixWeeks, styles.WithWeekNumbers]"
  >
    <div :class="styles.Nav">
      <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
      <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
    </div>
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Caption :class="styles.Caption" />
          <Calendar.Grid :class="styles.Grid">
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <Calendar.WeekNumberHeader :class="styles.Weekday">#</Calendar.WeekNumberHeader>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" :class="styles.Weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <Calendar.WeekNumber :week="week" :class="styles.WeekNumber" />
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
  </Calendar.Root>
</template>
