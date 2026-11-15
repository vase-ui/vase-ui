<script setup lang="ts">
import { shallowRef } from 'vue';
import * as Calendar from '../index.parts';

defineOptions({ inheritAttrs: false });

// The root exposes `focus`. A test reads it through `root`.
const root = shallowRef<{ focus: (date?: Temporal.PlainDate) => void } | null>(null);

defineExpose({ root });
</script>

<template>
  <Calendar.Root ref="root" v-bind="$attrs">
    <Calendar.Months>
      <template #month="{ month }">
        <Calendar.Month :month="month">
          <Calendar.Grid>
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
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
  </Calendar.Root>
</template>
