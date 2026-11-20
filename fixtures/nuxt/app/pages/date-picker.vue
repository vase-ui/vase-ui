<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';

const today = Temporal.PlainDate.from('2026-11-14');
const day = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-10'));
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <DatePicker.Root v-model="day" name="when" locale="en-US" time-zone="UTC">
        <DatePicker.Field data-testid="when">
          <DateField.Input>
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :data-testid="`when-${segment.type}`"
              />
              <DateField.Literal v-else :segment="segment" />
            </template>
          </DateField.Input>
        </DatePicker.Field>
        <DatePicker.Trigger data-testid="when-trigger" aria-label="Choose date">Open</DatePicker.Trigger>
        <Popover.Portal>
          <DatePicker.Positioner>
            <DatePicker.Popup aria-label="Choose date" data-testid="when-popup">
              <DatePicker.Calendar :today="today" data-testid="when-calendar">
                <Calendar.Months>
                  <template #month="{ month }">
                    <Calendar.Month :month="month">
                      <Calendar.Grid>
                        <Calendar.GridBody>
                          <template #week="{ week }">
                            <Calendar.Week :week="week">
                              <template #day="{ day: date }">
                                <Calendar.Day :day="date" :data-date="date.toString()"
                                  ><Calendar.DayButton
                                /></Calendar.Day>
                              </template>
                            </Calendar.Week>
                          </template>
                        </Calendar.GridBody>
                      </Calendar.Grid>
                    </Calendar.Month>
                  </template>
                </Calendar.Months>
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </DatePicker.Positioner>
        </Popover.Portal>
      </DatePicker.Root>
    </form>
    <output data-testid="when-value">{{ day?.toString() ?? '' }}</output>
  </main>
</template>
