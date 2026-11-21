<script setup lang="ts">
import type { PropType } from 'vue';

// An element whose `--y` follows `scene.movement`, with the default slot in it.
defineProps({
  scene: { type: Object as PropType<{ movement: number }>, required: true },
});
</script>

<template>
  <div :style="{ '--y': `${scene.movement}px` }"><slot /></div>
</template>
