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
  <ToastLabelContent
    v-if="toast.actionProps?.children !== undefined"
    :label="toast.actionProps.children"
  />
  <slot v-else-if="$slots.default" />
</template>
