<script setup lang="ts">
import ToastRoot from '../../src/toast/root/ToastRoot.vue';
import ToastLabelContent from '../../src/toast/utils/ToastLabelContent.vue';
import { useToastManager } from '../../src/toast/useToastManager';

// A list of the toasts of the provider above. Each toast is a `Toast.Root` that has its id as
// `data-testid` and shows its title, as text or as the content of a function. It needs no label part.
const { toasts } = useToastManager();
</script>

<template>
  <ToastRoot v-for="toast in toasts" :key="toast.id" :toast="toast" :data-testid="toast.id">
    <ToastLabelContent :label="toast.title" />
  </ToastRoot>
</template>
