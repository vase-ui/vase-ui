<script setup lang="ts">
import 'temporal-polyfill/global';
import { Calendar } from '@vase-ui/vue/calendar';
import '../../../behavior/style.css';

const locale = new URLSearchParams(location.search).get('locale') ?? 'en-US';
const defaultValue = Temporal.PlainDate.from('2026-01-31');
</script>

<template>
  <div class="bench-page">
    <Calendar.Root data-bench="calendar" :default-value="defaultValue" :locale="locale">
      <Calendar.PreviousButton>&lsaquo;</Calendar.PreviousButton>
      <Calendar.NextButton>&rsaquo;</Calendar.NextButton>
      <Calendar.Months>
        <template #month="{ month }">
          <Calendar.Month :month="month">
            <Calendar.Caption data-bench="calendar-heading" />
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
    </Calendar.Root>
  </div>
</template>
