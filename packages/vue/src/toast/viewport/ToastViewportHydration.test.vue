<script setup lang="ts">
import ToastTextList from '../../../test/fixtures/ToastTextList.vue';
import ToastPortal from '../portal/ToastPortal.vue';
import ToastProvider from '../provider/ToastProvider.vue';
import ToastViewport from './ToastViewport.vue';
import ToastViewportAdder from './ToastViewportAdder.test.vue';

defineProps<{
  portal?: boolean;
  /** The label of the high priority toast that `setup` adds. With no value, no toast is added. */
  toast?: 'text' | 'component';
}>();
</script>

<template>
  <ToastProvider>
    <ToastViewportAdder v-if="toast" :label="toast" />
    <ToastPortal v-if="portal">
      <ToastViewport><ToastTextList /></ToastViewport>
    </ToastPortal>
    <ToastViewport v-else><ToastTextList /></ToastViewport>
  </ToastProvider>
</template>
