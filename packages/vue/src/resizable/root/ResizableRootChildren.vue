<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import ResizableRootEdge from './ResizableRootEdge.vue';
import { useResizableRootEdgesContext } from './ResizableRootContext';

defineSlots<{
  default?(): unknown;
}>();

const { edges } = useResizableRootEdgesContext();

markChildrenMounted();
</script>

<template>
  <slot />
  <ResizableRootEdge
    v-for="boundary in edges"
    :key="boundary.before.id.value"
    :boundary="boundary"
  />
</template>
