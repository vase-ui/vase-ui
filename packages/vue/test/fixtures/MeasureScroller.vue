<script setup lang="ts">
import type { PropType } from 'vue';

// An element whose `:style` has `padding-bottom` only with `scene.own`.
defineProps({
  scene: { type: Object as PropType<{ tick: number; own: boolean }>, required: true },
});
</script>

<template>
  <div
    id="scroller"
    :data-tick="scene.tick"
    :style="scene.own ? { paddingBottom: '4px', color: 'red' } : { color: 'red' }"
  />
</template>
