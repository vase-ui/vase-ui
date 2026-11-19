<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import MeasureLabel from './MeasureLabel.vue';

// The parent writes an id that the child gives in its `setup`, as a root names its label.
const labelId = shallowRef<string>();
provide('label id', labelId);
</script>

<template>
  <div role="meter" aria-valuenow="30" :aria-labelledby="labelId">
    <MeasureLabel />
  </div>
</template>
