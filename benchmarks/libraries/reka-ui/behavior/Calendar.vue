<script setup lang="ts">
import { CalendarDate } from '@internationalized/date';
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from 'reka-ui';
import '../../../behavior/style.css';

const locale = new URLSearchParams(location.search).get('locale') ?? 'en-US';
const defaultValue = new CalendarDate(2026, 1, 31);
</script>

<template>
  <div class="bench-page">
    <CalendarRoot
      v-slot="{ weekDays, grid }"
      data-bench="calendar"
      :default-value="defaultValue"
      :locale="locale"
    >
      <CalendarHeader>
        <CalendarPrev>&lsaquo;</CalendarPrev>
        <CalendarHeading data-bench="calendar-heading" />
        <CalendarNext>&rsaquo;</CalendarNext>
      </CalendarHeader>
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell v-for="day in weekDays" :key="day">{{ day }}</CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`">
            <CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
              <CalendarCellTrigger :day="weekDate" :month="month.value" />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </CalendarRoot>
  </div>
</template>
