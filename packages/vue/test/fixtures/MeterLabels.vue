<script setup lang="ts">
import type { PropType } from 'vue';
import { Meter } from '../../src/meter';

// The `id` of each label, in the order of the document.
defineProps({ ids: { type: Array as PropType<string[]>, required: true } });
</script>

<template>
  <Meter.Root :value="30">
    <Meter.Label v-for="id in ids" :id="id" :key="id">{{ id }}</Meter.Label>
  </Meter.Root>
</template>
