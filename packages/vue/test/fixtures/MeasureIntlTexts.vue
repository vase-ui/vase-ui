<script setup lang="ts">
import { localeCalendar } from '../../src/internals/date-time/format';

// For each locale: the texts that the calendar parts take from `Intl` for a Gregorian date and a
// range of years, then the calendar of the locale. A server render and a client render give the same HTML when the
// data of `Intl` is the same.
defineProps<{ locales: string[] }>();

const day = Date.UTC(2026, 10, 18);
const format = (locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: 'UTC', calendar: 'gregory', ...options }).format(day);
const range = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    calendar: 'gregory',
    year: 'numeric',
  }).formatRange(Date.UTC(2016, 0, 1), day);
const texts = (locale: string) => [
  range(locale),
  format(locale, { month: 'long', year: 'numeric' }),
  format(locale, { weekday: 'short' }),
  format(locale, { weekday: 'long' }),
  format(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  format(locale, { day: 'numeric' }),
  new Intl.NumberFormat(locale).format(47),
  new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of('month'),
  new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of('weekOfYear'),
  new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(1, 'month'),
];
</script>

<template>
  <ul>
    <li v-for="locale in locales" :key="locale" :data-calendar="localeCalendar(locale)">
      <span v-for="(text, index) in texts(locale)" :key="index">{{ text }}</span>
    </li>
  </ul>
</template>
