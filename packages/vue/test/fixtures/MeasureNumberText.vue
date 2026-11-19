<script setup lang="ts">
import type { PropType } from 'vue';

interface Row {
  locale: string;
  options: Intl.NumberFormatOptions;
  value: number;
}

// The text of `Intl.NumberFormat` for each row, in the environment that renders it.
defineProps({ rows: { type: Array as PropType<Row[]>, required: true } });

function format({ locale, options, value }: Row) {
  return new Intl.NumberFormat(locale, options).format(value);
}
</script>

<template>
  <ul>
    <li v-for="(row, index) in rows" :key="index">{{ format(row) }}</li>
  </ul>
</template>
