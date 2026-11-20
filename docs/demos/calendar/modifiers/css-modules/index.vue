<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

const holidays = [
  { date: Temporal.PlainDate.from('2026-11-11'), name: 'Veterans Day' },
  { date: Temporal.PlainDate.from('2026-11-26'), name: 'Thanksgiving Day' },
  { date: Temporal.PlainDate.from('2026-12-25'), name: 'Christmas Day' },
];
const modifiers = { holiday: holidays.map(({ date }) => date) };
const selected = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-26'));

function holidayName(date: Temporal.PlainDate | null) {
  return holidays.find((holiday) => date?.equals(holiday.date))?.name;
}

const message = computed(() => holidayName(selected.value) ?? 'A dot marks a public holiday.');
</script>

<template>
  <Calendar.Root
    v-model="selected"
    :modifiers="modifiers"
    locale="en-US"
    :first-day-of-week="7"
    aria-label="Day off"
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
                      <Calendar.DayButton
                        :aria-description="holidayName(day)"
                        :class="[styles.DayButton, styles.Holiday]"
                      />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      </template>
    </Calendar.Months>
    <Calendar.Footer :class="styles.Footer">{{ message }}</Calendar.Footer>
  </Calendar.Root>
</template>
