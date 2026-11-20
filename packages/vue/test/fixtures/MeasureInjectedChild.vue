<script setup lang="ts">
import { inject } from 'vue';

const scene = inject<{ open: boolean }>('measure scene')!;
</script>

<template>
  <div v-if="scene.open" class="MeasurePanel">Content</div>
</template>
