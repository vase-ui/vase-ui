<script setup lang="ts">
import type { DemoVariant } from './demoVariant.ts';

defineProps<{ variant: DemoVariant }>();
</script>

<template>
  <div class="demo-source" :data-variant="variant"><slot /></div>
</template>

<style scoped>
:root[data-demo-variant='tailwind'] .demo-source[data-variant='css-modules'],
:root:not([data-demo-variant='tailwind']) .demo-source[data-variant='tailwind'] {
  display: none;
}
</style>
