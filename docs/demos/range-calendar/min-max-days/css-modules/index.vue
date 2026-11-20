<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
import styles from '../../_index.module.css';

const value = shallowRef<RangeCalendar.Root.Value>([
  Temporal.PlainDate.from('2026-11-09'),
  Temporal.PlainDate.from('2026-11-12'),
]);
const formatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function format(date: Temporal.PlainDate) {
  return formatter.format(Date.UTC(date.year, date.month - 1, date.day));
}

const summary = computed(() => {
  const [start, end] = value.value;
  if (!start) {
    return 'Pick 3 to 7 days.';
  }
  return end
    ? `${format(start)} to ${format(end)}, ${end.since(start).days + 1} days.`
    : `From ${format(start)}. Pick the last day.`;
});
</script>

<template>
  <RangeCalendar.Root
    :class="styles.Root"
    v-model="value"
    aria-label="Rental dates"
    :min-days="3"
    :max-days="7"
    locale="en-US"
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
    <Calendar.Footer :class="styles.Footer">{{ summary }}</Calendar.Footer>
  </RangeCalendar.Root>
</template>
