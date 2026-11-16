<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { TimeField } from '@vase-ui/vue/time-field';
</script>

<template>
  <DatePicker.Root>
    <DatePicker.Field>
      <DateField.Input />
    </DatePicker.Field>
    <DatePicker.Trigger />
    <DatePicker.Portal>
      <DatePicker.Positioner>
        <DatePicker.Popup>
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
          <DatePicker.TimeField>
            <TimeField.Input />
          </DatePicker.TimeField>
          <DatePicker.Close />
        </DatePicker.Popup>
      </DatePicker.Positioner>
    </DatePicker.Portal>
  </DatePicker.Root>
</template>
