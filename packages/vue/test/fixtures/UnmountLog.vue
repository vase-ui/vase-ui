<script setup lang="ts">
import { onUnmounted } from 'vue';

// A child that writes `child unmounted` in `log` at its unmount.
const props = defineProps<{ log: { add(entry: string): void } }>();
onUnmounted(() => props.log.add('child unmounted'));
</script>

<template>
  <span>Child</span>
</template>
