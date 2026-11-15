<script setup lang="ts">
import { shallowRef } from 'vue';
import * as Calendar from '../index.parts';

defineOptions({ inheritAttrs: false });

// The selects, the week numbers and the footer are in the anatomy when a prop gives them. The
// props of the root go through the attributes.
withDefaults(
  defineProps<{ selects?: boolean; weekNumbers?: boolean; footer?: string | undefined }>(),
  { selects: false, weekNumbers: false, footer: undefined },
);

// The root exposes `focus`. A test reads it through `root`.
const root = shallowRef<{ focus: (date?: Temporal.PlainDate) => void } | null>(null);

defineExpose({ root });
</script>

<template>
  <Calendar.Root ref="root" v-bind="$attrs">
    <Calendar.PreviousButton data-testid="previous" />
    <Calendar.NextButton data-testid="next" />
    <template v-if="selects">
      <Calendar.MonthSelect data-testid="month-select" />
      <Calendar.YearSelect data-testid="year-select" />
    </template>
    <Calendar.Months data-testid="months">
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Caption />
          <Calendar.Grid>
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <Calendar.WeekNumberHeader v-if="weekNumbers">#</Calendar.WeekNumberHeader>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <Calendar.WeekNumber v-if="weekNumbers" :week="week" />
                  <template #day="{ day }">
                    <Calendar.Day :day="day">
                      <Calendar.DayButton />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      </template>
    </Calendar.Months>
    <Calendar.Footer v-if="footer !== undefined">{{ footer }}</Calendar.Footer>
  </Calendar.Root>
</template>
