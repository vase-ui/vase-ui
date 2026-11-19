<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureDisabledReader from './MeasureDisabledReader.vue';

defineProps({ scene: { type: Object as PropType<{ disabled: boolean }>, required: true } });
</script>

<template>
  <fieldset :disabled="scene.disabled">
    <MeasureDisabledReader />
  </fieldset>
</template>
