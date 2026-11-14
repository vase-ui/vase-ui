<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';

defineSlots<{
  default?(): unknown;
}>();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" />
  <template v-else>▼</template>
</template>
