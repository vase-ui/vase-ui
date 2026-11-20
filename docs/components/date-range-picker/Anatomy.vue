<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Calendar } from '@vase-ui/vue/calendar';
</script>

<template>
  <DateRangePicker.Root>
    <DateRangePicker.StartField>
      <DateField.Input />
    </DateRangePicker.StartField>
    <DateRangePicker.EndField>
      <DateField.Input />
    </DateRangePicker.EndField>
    <DateRangePicker.Trigger />
    <DateRangePicker.Portal>
      <DateRangePicker.Positioner>
        <DateRangePicker.Popup>
          <DateRangePicker.Calendar>
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
          </DateRangePicker.Calendar>
          <DateRangePicker.Close />
        </DateRangePicker.Popup>
      </DateRangePicker.Positioner>
    </DateRangePicker.Portal>
  </DateRangePicker.Root>
</template>
