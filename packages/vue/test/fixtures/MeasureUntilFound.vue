<script setup lang="ts">
import type { PropType } from 'vue';

// Vue writes the attribute `hidden` with the value `until-found` while `scene.closed` is true.
defineProps({
  scene: { type: Object as PropType<{ closed: boolean }>, default: () => ({ closed: true }) },
});
</script>

<template>
  <div class="Measured" :hidden="scene.closed ? 'until-found' : undefined">Content</div>
</template>
