<script setup lang="ts">
import { markChildrenMounted } from '../../../internals/useRenderElement';

defineSlots<{
  default?(): unknown;
}>();

markChildrenMounted();
</script>

<template>
  <slot />
</template>
