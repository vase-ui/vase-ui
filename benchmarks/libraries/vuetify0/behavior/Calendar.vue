<script setup lang="ts">
import { createCalendar } from '@vuetify/v0';
import '../../../behavior/style.css';

const calendar = createCalendar({
  month: '2026-01',
  value: '2026-01-31',
  locale: new URLSearchParams(location.search).get('locale') ?? 'en-US',
});
const { month, label, weekdays } = calendar;
</script>

<template>
  <div class="bench-page">
    <div data-bench="calendar">
      <div>
        <button type="button" @click="calendar.prev()">Prev</button>
        <span data-bench="calendar-heading">{{ label }}</span>
        <button type="button" @click="calendar.next()">Next</button>
      </div>
      <div>
        <span v-for="(name, index) in weekdays" :key="index">{{ name }}</span>
      </div>
      <div v-for="(week, weekIndex) in month.weeks" :key="weekIndex">
        <button
          v-for="cell in week"
          :key="cell.iso"
          :data-disabled="cell.disabled || undefined"
          :data-outside="cell.outside || undefined"
          :data-today="cell.today || undefined"
          :disabled="cell.disabled || cell.outside"
          type="button"
          @click="calendar.select(cell.iso)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
  </div>
</template>
