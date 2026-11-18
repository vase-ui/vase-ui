<script setup lang="ts">
import { computed, shallowRef } from 'vue';
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
    <RangeCalendar.Footer :class="styles.Footer">{{ summary }}</RangeCalendar.Footer>
  </RangeCalendar.Root>
</template>
