<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureLoggedLink from './MeasureLoggedLink.vue';

// A link in a component that a `v-if` removes.
defineProps({
  scene: { type: Object as PropType<{ shown: boolean }>, required: true },
  log: { type: Array as PropType<string[]>, required: true },
});
</script>

<template>
  <MeasureLoggedLink v-if="scene.shown" :log />
</template>
