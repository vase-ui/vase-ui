<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '../../calendar';
import * as DateField from '../../date-field/parts';
import * as TimeField from '../../time-field/parts';
import * as DatePicker from '../index.parts';

defineOptions({ inheritAttrs: false });

// The attributes go to the root. `calendarProps` goes to the calendar, and `popupProps` to the popup.
withDefaults(
  defineProps<{
    calendarProps?: Record<string, unknown>;
    popupProps?: Record<string, unknown>;
    hasField?: boolean;
    trigger?: boolean;
    timeField?: boolean;
    monthGrid?: boolean;
    keepMounted?: boolean;
  }>(),
  { calendarProps: () => ({}), popupProps: () => ({}), hasField: true, trigger: true },
);

// The parts expose their members. A test reads them through `root`, `field` and `calendar`.
const root = shallowRef<{ close: () => void; unmount: () => void } | null>(null);
const field = shallowRef<{
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
} | null>(null);
const calendar = shallowRef<{
  element: HTMLElement | null;
  focus: (date?: Temporal.PlainDate) => void;
} | null>(null);

defineExpose({ root, field, calendar });
</script>

<template>
  <DatePicker.Root ref="root" v-bind="$attrs">
    <DatePicker.Field v-if="hasField" ref="field" data-testid="field">
      <DateField.Input />
    </DatePicker.Field>
    <DatePicker.Trigger v-if="trigger" data-testid="trigger">Open</DatePicker.Trigger>
    <DatePicker.Portal :keep-mounted="keepMounted">
      <DatePicker.Positioner data-testid="positioner">
        <DatePicker.Popup aria-label="Choose date" data-testid="popup" v-bind="popupProps">
          <DatePicker.Calendar ref="calendar" v-bind="calendarProps" data-testid="calendar">
            <Calendar.PreviousButton data-testid="previous" />
            <Calendar.NextButton data-testid="next" />
            <Calendar.Months>
              <template #month="{ month }">
                <Calendar.Month :month="month">
                  <Calendar.Caption />
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
                            <Calendar.Day :day="day" :data-date="day.toString()">
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
            <Calendar.MonthGrid v-if="monthGrid">
              <template #row="{ months }">
                <Calendar.MonthGridRow>
                  <Calendar.MonthCell
                    v-for="month in months"
                    :key="month.toString()"
                    :month="month"
                  />
                </Calendar.MonthGridRow>
              </template>
            </Calendar.MonthGrid>
          </DatePicker.Calendar>
          <DatePicker.TimeField v-if="timeField" aria-label="Time" data-testid="time-field">
            <TimeField.Input />
          </DatePicker.TimeField>
          <DatePicker.Close>Close</DatePicker.Close>
        </DatePicker.Popup>
      </DatePicker.Positioner>
    </DatePicker.Portal>
  </DatePicker.Root>
</template>
