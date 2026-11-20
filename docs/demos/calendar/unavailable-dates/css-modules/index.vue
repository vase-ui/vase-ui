<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

// A server does not know the day of the reader, so the value comes after the mount.
const today = shallowRef<Temporal.PlainDate>();
onMounted(() => {
  today.value = Temporal.Now.plainDateISO();
});
const booked = computed(() =>
  today.value
    ? [
        today.value.add({ days: 4 }),
        { start: today.value.add({ days: 10 }), end: today.value.add({ days: 13 }) },
      ]
    : [],
);
const selected = shallowRef<Temporal.PlainDate | null>(null);
</script>

<template>
  <Calendar.Root
    v-model="selected"
    :min="today"
    :unavailable-dates="booked"
    locale="en-US"
    aria-label="Appointment day"
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
  </Calendar.Root>
</template>
