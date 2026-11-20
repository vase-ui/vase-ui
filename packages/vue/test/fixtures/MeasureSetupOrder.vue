<script setup lang="ts">
import { provide } from 'vue';
import MeasureSetupOrderItem from './MeasureSetupOrderItem.vue';

// Each item takes the next number of the counter in its `setup`.
let next = 0;
provide('claim', () => next++);
</script>

<template>
  <div>
    <template v-for="n in 6" :key="n">
      <span v-if="n === 3"><MeasureSetupOrderItem /></span>
      <MeasureSetupOrderItem v-else />
      <hr v-if="n === 4" />
    </template>
  </div>
</template>
