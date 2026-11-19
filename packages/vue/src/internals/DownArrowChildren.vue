<script setup lang="ts">
import { markChildrenMounted } from './useRenderElement';

defineSlots<{
  default?(): unknown;
}>();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" />
  <template v-else>▼</template>
</template>
