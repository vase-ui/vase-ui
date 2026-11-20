<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import styles from '../../_index.module.css';

const call = shallowRef(Temporal.ZonedDateTime.from('2026-11-17T09:00[Asia/Tokyo]'));
const summary = computed(() => {
  const date = call.value.toPlainDate().toString();
  const time = call.value.toPlainTime().toString({ smallestUnit: 'minute' });
  return `${date} at ${time}, ${call.value.timeZoneId}`;
});
</script>

<template>
  <Calendar.Root
    v-model="call"
    locale="en-US"
    aria-label="Day of the call"
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
    <Calendar.Footer :class="styles.Footer">{{ summary }}</Calendar.Footer>
  </Calendar.Root>
</template>
