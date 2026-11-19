<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({
  cases: {
    type: Array as PropType<{ locale: string; options: Intl.NumberFormatOptions }[]>,
    required: true,
  },
  value: { type: Number, required: true },
});
</script>

<template>
  <p v-for="{ locale, options } in cases" :key="JSON.stringify([locale, options])">
    {{ new Intl.NumberFormat(locale, options).format(value) }}
  </p>
</template>
