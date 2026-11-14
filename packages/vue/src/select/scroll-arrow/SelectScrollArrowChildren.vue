<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useSelectScrollArrowContext } from './SelectScrollArrowContext';

defineSlots<{
  default?(): unknown;
}>();

const direction = useSelectScrollArrowContext();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" />
  <template v-else>{{ direction === 'up' ? '▲' : '▼' }}</template>
</template>
