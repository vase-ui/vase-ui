<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';
</script>

<template>
  <Calendar.Root
    fixed-weeks
    show-outside-days
    locale="en-US"
    :class="[styles.Root, styles.SixWeeks]"
  >
    <div :class="styles.Nav">
      <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
      <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
    </div>
    <Calendar.Months :class="styles.Pages">
      <template #month="{ month }">
        <Calendar.Month :month="month" :class="styles.Page">
          <Calendar.Caption :class="styles.Caption" />
          <Transition name="calendar-page">
            <Calendar.Grid :key="month.first.toString()" :class="[styles.Grid, styles.PageGrid]">
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
          </Transition>
        </Calendar.Month>
      </template>
    </Calendar.Months>
  </Calendar.Root>
</template>
