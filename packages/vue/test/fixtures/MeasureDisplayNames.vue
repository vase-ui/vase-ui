<script setup lang="ts">
// For each locale: the names of `Intl.DisplayNames` that a column of a time picker takes for its
// unit. A server render and a client render give the same HTML when the data of `Intl` is the same.
defineProps<{ locales: string[] }>();

const units = ['hour', 'minute', 'second', 'dayPeriod'];
const names = (locale: string) =>
  units.map((unit) => new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of(unit));
</script>

<template>
  <ul>
    <li v-for="locale in locales" :key="locale" :data-locale="locale">
      {{ names(locale).join('|') }}
    </li>
  </ul>
</template>
