<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';
import { TimeField } from '@vase-ui/vue/time-field';
</script>

<template>
  <DatePicker.Root>
    <DatePicker.Field>
      <DateField.Input />
    </DatePicker.Field>
    <DatePicker.Trigger aria-label="Choose date" />
    <Popover.Portal>
      <DatePicker.Positioner>
        <DatePicker.Popup aria-label="Choose a date">
          <DatePicker.Calendar>
            <Calendar.PreviousButton />
            <Calendar.NextButton />
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
          </DatePicker.Calendar>
          <DatePicker.TimeField aria-label="Time">
            <TimeField.Input />
          </DatePicker.TimeField>
          <Popover.Close />
        </DatePicker.Popup>
      </DatePicker.Positioner>
    </Popover.Portal>
  </DatePicker.Root>
</template>
