<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast, type ToastManager } from '../../src/toast';

const props = defineProps({ manager: { type: Object as PropType<ToastManager>, required: true } });
props.manager.add({ id: 'in-provider', title: 'In the provider' });
const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Viewport aria-label="Notifications">
    <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" :data-id="toast.id" />
  </Toast.Viewport>
</template>
