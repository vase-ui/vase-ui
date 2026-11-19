<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import MeasureLabelOnServerLabel from './MeasureLabelOnServerLabel.vue';

defineProps<{ role: 'meter' | 'progressbar' }>();

// A parent element whose `aria-labelledby` is the id that a child component gives in `setup`.
const labelId = shallowRef<string>();
provide('label id', labelId);
</script>

<template>
  <div :role="role" :aria-labelledby="labelId">
    <MeasureLabelOnServerLabel>Name</MeasureLabelOnServerLabel>
  </div>
</template>
