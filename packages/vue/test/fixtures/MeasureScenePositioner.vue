<script setup lang="ts">
import { inject } from 'vue';

// A part that renders its root element and its content while the scene is open, as a portal does.
const scene = inject<{ open: boolean }>('scene')!;
</script>

<template>
  <div v-if="scene.open"><slot /></div>
</template>
