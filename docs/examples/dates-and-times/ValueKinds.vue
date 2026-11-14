<script setup lang="ts">
import { ref } from 'vue';

// A date with no time.
const date = ref(Temporal.PlainDate.from('2026-11-14'));
// A date and a time.
const dateTime = ref(Temporal.PlainDateTime.from('2026-11-14T10:30'));
// A date and a time in a time zone.
const zoned = ref(Temporal.ZonedDateTime.from('2026-11-14T10:30[Europe/Paris]'));
// A time with no date.
const time = ref(Temporal.PlainTime.from('10:30'));
// A month and a year.
const month = ref(Temporal.PlainYearMonth.from('2026-11'));
</script>

<template>
  <ul>
    <li>{{ date.toString() }}</li>
    <li>{{ dateTime.toString() }}</li>
    <li>{{ zoned.toString() }}</li>
    <li>{{ time.toString() }}</li>
    <li>{{ month.toString() }}</li>
  </ul>
</template>
