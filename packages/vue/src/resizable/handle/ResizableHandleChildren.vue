<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useResizableHandleContext } from '../root/ResizableRootContext';

defineSlots<{
  default?(): unknown;
}>();

const { hitAreaStyle, hitAreaRef } = useResizableHandleContext();

markChildrenMounted();
</script>

<template>
  <slot />
  <span data-vase-ui-resizable-hit-area :ref="hitAreaRef" :style="hitAreaStyle" />
</template>
