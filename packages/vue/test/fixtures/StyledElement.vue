<script setup lang="ts">
import type { CSSProperties } from 'vue';

// With `data-allow-mismatch="style"` in the template, Vue gives no warning for a style mismatch.
// Only the DOM comparison of `hydrate` can then report the difference.
defineProps<{
  /** The style of the element. */
  elementStyle: CSSProperties;
}>();
</script>

<template>
  <div data-allow-mismatch="style" :style="elementStyle" />
</template>
