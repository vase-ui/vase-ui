<script setup lang="ts">
import type { PropType } from 'vue';
import MeasurePortal from './MeasurePortal.vue';

// Two teleports to `<body>`, the child in the content of the parent, that render in one update.
defineProps({
  afterMount: Boolean,
  defer: Boolean,
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
</script>

<template>
  <MeasurePortal v-if="scene.open" :after-mount :defer>
    <div id="parent">
      <MeasurePortal :after-mount :defer><div id="child" /></MeasurePortal>
    </div>
  </MeasurePortal>
</template>
