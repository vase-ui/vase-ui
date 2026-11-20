<script setup lang="ts">
import { inject } from 'vue';

// A part that renders its root element while the scene is open, as `Popover.Popup` does.
const scene = inject<{ open: boolean }>('scene')!;
</script>

<template>
  <div v-if="scene.open" class="popup">Popup</div>
</template>
