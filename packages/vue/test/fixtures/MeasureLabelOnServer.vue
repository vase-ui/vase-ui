<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import MeasureLabelOnServerLabel from './MeasureLabelOnServerLabel.vue';

// A parent element whose `aria-labelledby` is the id that a child component gives in `setup`.
const labelId = shallowRef<string>();
provide('label id', labelId);
</script>

<template>
  <div role="progressbar" :aria-labelledby="labelId">
    <MeasureLabelOnServerLabel>Upload</MeasureLabelOnServerLabel>
  </div>
</template>
