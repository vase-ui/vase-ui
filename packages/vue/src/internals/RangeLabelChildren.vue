<script setup lang="ts">
import { visuallyHidden } from '../common/visuallyHidden';
import { markChildrenMounted } from './useRenderElement';

// NVDA and JAWS need text inside the range to announce its label.
markChildrenMounted();
</script>

<template>
  <slot />
  <span role="presentation" :style="visuallyHidden">x</span>
</template>
