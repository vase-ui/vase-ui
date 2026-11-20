<script setup lang="ts">
import { shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { TimeClock } from '@vase-ui/vue/time-clock';

const time = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('13:45'));
const date = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-10'));
const today = Temporal.PlainDate.from('2026-11-14');
</script>

<template>
  <main>
    <TimeClock.Root v-model="time" locale="is-IS" aria-label="Time" data-testid="clock">
      <TimeClock.ViewTrigger view="hour" data-testid="hour" />
      <TimeClock.ViewTrigger view="minute" data-testid="minute" />
      <TimeClock.DayPeriod value="am" data-testid="period" />
      <TimeClock.DayPeriod value="pm" data-testid="period" />
      <TimeClock.Face>
        <TimeClock.Hand />
        <template #number="{ number }">
          <TimeClock.Number :number="number" data-testid="number" />
        </template>
      </TimeClock.Face>
    </TimeClock.Root>
    <output data-testid="time-value">{{ time?.toString() ?? '' }}</output>

    <Calendar.Root
      v-model="date"
      :today="today"
      locale="is-IS"
      :first-day-of-week="7"
      :modifiers="{ weekend: { dayOfWeek: [6, 7] } }"
      data-testid="calendar"
    >
      <Calendar.Months>
        <template #month="{ month }">
          <Calendar.Month :month="month">
            <Calendar.Caption data-testid="caption" />
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
                      <Calendar.Day :day="day" :data-date="day.toString()"
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
    </Calendar.Root>
    <output data-testid="date-value">{{ date?.toString() ?? '' }}</output>
  </main>
</template>
