<script setup lang="ts">
import { shallowRef } from 'vue';
import * as RangeCalendar from '../index.parts';

defineOptions({ inheritAttrs: false });

// A test that needs a button outside the grid turns the button on.
defineProps<{ nextButton?: boolean }>();

// The root exposes `focus`. A test reads it through `root`.
const root = shallowRef<{ focus: (date?: Temporal.PlainDate) => void } | null>(null);

defineExpose({ root });
</script>

<template>
  <RangeCalendar.Root ref="root" v-bind="$attrs">
    <RangeCalendar.NextButton v-if="nextButton" data-testid="next" />
    <RangeCalendar.Months>
      <template #month="{ month }">
        <RangeCalendar.Month :month="month">
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              <RangeCalendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <RangeCalendar.Weekday :weekday="weekday" />
                </template>
              </RangeCalendar.GridHeaderRow>
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              <template #week="{ week }">
                <RangeCalendar.Week :week="week">
                  <template #day="{ day }">
                    <RangeCalendar.Day :day="day">
                      <RangeCalendar.DayButton />
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
