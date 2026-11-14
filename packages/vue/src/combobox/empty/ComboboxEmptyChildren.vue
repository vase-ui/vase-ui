<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useListEmpty } from '../utils/parts';

defineSlots<{
  default?(): unknown;
}>();

const empty = useListEmpty();

markChildrenMounted();
</script>

<template>
  <slot v-if="empty" />
</template>
