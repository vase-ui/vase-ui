<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
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
            <RangeCalendar.PreviousButton />
            <RangeCalendar.NextButton />
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
          <DateRangePicker.Close />
        </DateRangePicker.Popup>
      </DateRangePicker.Positioner>
    </DateRangePicker.Portal>
  </DateRangePicker.Root>
</template>
