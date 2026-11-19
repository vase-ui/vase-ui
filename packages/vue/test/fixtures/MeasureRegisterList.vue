<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureRegister from './MeasureRegister.vue';

defineProps({
  names: { type: Array as PropType<string[]>, required: true },
  log: { type: Array as PropType<string[]>, required: true },
});
</script>

<template>
  <div>
    <MeasureRegister v-for="name in names" :key="name" :name="name" :log="log" />
  </div>
</template>
