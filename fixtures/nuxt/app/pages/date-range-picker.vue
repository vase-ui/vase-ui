<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Calendar } from '@vase-ui/vue/calendar';
import { Popover } from '@vase-ui/vue/popover';

const today = Temporal.PlainDate.from('2026-11-14');
const range = shallowRef<DateRangePicker.Root.Value<Temporal.PlainDate>>([
  Temporal.PlainDate.from('2026-11-10'),
  Temporal.PlainDate.from('2026-11-12'),
]);
const text = computed(() => range.value.map((end) => end?.toString() ?? '').join(' '));
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <DateRangePicker.Root
        v-model="range"
        start-name="from"
        end-name="to"
        locale="en-US"
        time-zone="UTC"
      >
        <DateRangePicker.StartField data-testid="from" aria-label="Start date">
          <DateField.Input>
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :data-testid="`from-${segment.type}`"
              />
              <DateField.Literal v-else :segment="segment" />
            </template>
          </DateField.Input>
        </DateRangePicker.StartField>
        <DateRangePicker.EndField data-testid="to" aria-label="End date">
          <DateField.Input>
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :data-testid="`to-${segment.type}`"
              />
              <DateField.Literal v-else :segment="segment" />
            </template>
          </DateField.Input>
        </DateRangePicker.EndField>
        <DateRangePicker.Trigger data-testid="when-trigger" aria-label="Choose dates"
          >Open</DateRangePicker.Trigger
        >
        <Popover.Portal>
          <DateRangePicker.Positioner>
            <DateRangePicker.Popup aria-label="Choose dates" data-testid="when-popup">
              <DateRangePicker.Calendar :today="today" data-testid="when-calendar">
                <Calendar.Months>
                  <template #month="{ month }">
                    <Calendar.Month :month="month">
                      <Calendar.Grid>
                        <Calendar.GridBody>
                          <template #week="{ week }">
                            <Calendar.Week :week="week">
                              <template #day="{ day: date }">
                                <Calendar.Day :day="date" :data-date="date.toString()">
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
            </DateRangePicker.Popup>
          </DateRangePicker.Positioner>
        </Popover.Portal>
      </DateRangePicker.Root>
    </form>
    <output data-testid="when-value">{{ text }}</output>
  </main>
</template>
