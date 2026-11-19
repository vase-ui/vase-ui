<script setup lang="ts">
import ToastAction from '../../src/toast/action/ToastAction.vue';
import ToastClose from '../../src/toast/close/ToastClose.vue';
import ToastDescription from '../../src/toast/description/ToastDescription.vue';
import ToastRoot from '../../src/toast/root/ToastRoot.vue';
import ToastTitle from '../../src/toast/title/ToastTitle.vue';
import { useToastManager } from '../../src/toast/useToastManager';

const { toasts } = useToastManager();
</script>

<template>
  <ToastRoot v-for="toastItem in toasts" :key="toastItem.id" :toast="toastItem" data-testid="root">
    <ToastTitle data-testid="title" />
    <ToastDescription data-testid="description" />
    <ToastClose aria-label="close-press" />
    <ToastAction data-testid="action" />
  </ToastRoot>
</template>
