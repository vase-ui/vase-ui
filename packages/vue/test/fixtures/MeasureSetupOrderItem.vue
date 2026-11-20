<script setup lang="ts">
import { inject } from 'vue';

const number = inject<() => number>('claim')!();
</script>

<template>
  <output>{{ number }}</output>
</template>
