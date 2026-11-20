<script setup lang="ts">
import { shallowRef } from 'vue';
import * as DateField from '../../date-field/parts';
import * as RangeCalendar from '../../range-calendar/index.parts';
import * as DateRangePicker from '../index.parts';

defineOptions({ inheritAttrs: false });

// The attributes go to the root. `calendarProps` goes to the calendar, and `popupProps` to the popup.
withDefaults(
  defineProps<{
    calendarProps?: Record<string, unknown>;
    popupProps?: Record<string, unknown>;
    hasFields?: boolean;
    trigger?: boolean;
    keepMounted?: boolean;
  }>(),
  { calendarProps: () => ({}), popupProps: () => ({}), hasFields: true, trigger: true },
);

// The parts expose their members. A test reads them through `root`, `startField`, `endField` and
// `calendar`.
const root = shallowRef<{ close: () => void; unmount: () => void } | null>(null);
const startField = shallowRef<{
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
} | null>(null);
const endField = shallowRef<{
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
} | null>(null);
const calendar = shallowRef<{
  element: HTMLElement | null;
  focus: (date?: Temporal.PlainDate) => void;
} | null>(null);

defineExpose({ root, startField, endField, calendar });
</script>

<template>
  <DateRangePicker.Root ref="root" v-bind="$attrs">
    <template v-if="hasFields">
      <DateRangePicker.StartField ref="startField" data-testid="start-field">
        <DateField.Input />
      </DateRangePicker.StartField>
      <DateRangePicker.EndField ref="endField" data-testid="end-field">
        <DateField.Input />
      </DateRangePicker.EndField>
    </template>
    <DateRangePicker.Trigger v-if="trigger" data-testid="trigger">Open</DateRangePicker.Trigger>
    <DateRangePicker.Portal :keep-mounted="keepMounted">
      <DateRangePicker.Positioner data-testid="positioner">
        <DateRangePicker.Popup aria-label="Choose dates" data-testid="popup" v-bind="popupProps">
          <DateRangePicker.Calendar ref="calendar" v-bind="calendarProps" data-testid="calendar">
            <RangeCalendar.PreviousButton data-testid="previous" />
            <RangeCalendar.NextButton data-testid="next" />
            <RangeCalendar.Months>
              <template #month="{ month }">
                <RangeCalendar.Month :month="month">
                  <RangeCalendar.Caption />
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
          </DateRangePicker.Calendar>
          <DateRangePicker.Close>Close</DateRangePicker.Close>
        </DateRangePicker.Popup>
      </DateRangePicker.Positioner>
    </DateRangePicker.Portal>
  </DateRangePicker.Root>
</template>
