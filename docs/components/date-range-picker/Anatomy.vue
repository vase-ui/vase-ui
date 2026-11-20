<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Calendar } from '@vase-ui/vue/calendar';
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <DateRangePicker.Root>
    <DateRangePicker.StartField aria-label="Start date">
      <DateField.Input />
    </DateRangePicker.StartField>
    <DateRangePicker.EndField aria-label="End date">
      <DateField.Input />
    </DateRangePicker.EndField>
    <DateRangePicker.Trigger aria-label="Choose dates" />
    <Popover.Portal>
      <DateRangePicker.Positioner>
        <DateRangePicker.Popup aria-label="Choose dates">
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
          <Popover.Close />
        </DateRangePicker.Popup>
      </DateRangePicker.Positioner>
    </Popover.Portal>
  </DateRangePicker.Root>
</template>
