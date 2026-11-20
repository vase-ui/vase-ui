<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureLoggedLink from './MeasureLoggedLink.vue';

// A link in a component that a `v-if` removes.
defineProps({
  scene: { type: Object as PropType<{ shown: boolean }>, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
</script>

<template>
  <MeasureLoggedLink v-if="scene.shown" :log />
</template>
