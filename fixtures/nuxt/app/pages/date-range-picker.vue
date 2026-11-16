<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';

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
        v-model:value="range"
        start-name="from"
        end-name="to"
        locale="en-US"
        time-zone="UTC"
      >
        <DateRangePicker.StartField data-testid="from">
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
        <DateRangePicker.EndField data-testid="to">
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
        <DateRangePicker.Trigger data-testid="when-trigger">Open</DateRangePicker.Trigger>
        <DateRangePicker.Portal>
          <DateRangePicker.Positioner>
            <DateRangePicker.Popup aria-label="Choose dates" data-testid="when-popup">
              <DateRangePicker.Calendar :today="today" data-testid="when-calendar">
                <RangeCalendar.Months>
                  <template #month="{ month }">
                    <RangeCalendar.Month :month="month">
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridBody>
                          <template #week="{ week }">
                            <RangeCalendar.Week :week="week">
                              <template #day="{ day: date }">
                                <RangeCalendar.Day :day="date">
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
            </DateRangePicker.Popup>
          </DateRangePicker.Positioner>
        </DateRangePicker.Portal>
      </DateRangePicker.Root>
    </form>
    <output data-testid="when-value">{{ text }}</output>
  </main>
</template>
