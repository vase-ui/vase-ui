<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

// A server does not know the day of the reader, so the value comes after the mount.
const today = shallowRef<Temporal.PlainDate>();
onMounted(() => {
  today.value = Temporal.Now.plainDateISO();
});
const days = shallowRef<Temporal.PlainDate[]>([]);
</script>

<template>
  <Calendar.Root
    v-model="days"
    multiple
    :max-days="3"
    :min="today"
    locale="en-US"
    aria-label="Interview days"
    :class="[styles.Root, styles.SixWeeks]"
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
    <Calendar.Footer :class="styles.Footer">{{ days.length }} of 3 days selected.</Calendar.Footer>
  </Calendar.Root>
</template>
