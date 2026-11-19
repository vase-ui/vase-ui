<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureRegister from './MeasureRegister.vue';

defineProps({ names: { type: Array as PropType<string[]>, required: true } });
const emit = defineEmits<{ log: [entry: string] }>();
</script>

<template>
  <div>
    <MeasureRegister v-for="name in names" :key="name" :name="name" @log="emit('log', $event)" />
  </div>
</template>
