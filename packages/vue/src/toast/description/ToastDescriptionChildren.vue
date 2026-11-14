<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import ToastLabelContent from '../utils/ToastLabelContent.vue';

defineSlots<{
  default?(): unknown;
}>();

const { toast } = useToastRootContext();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" />
  <ToastLabelContent v-else :label="toast.description" />
</template>
