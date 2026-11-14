<script setup lang="ts">
import ToastAction from '../action/ToastAction.vue';
import ToastClose from '../close/ToastClose.vue';
import ToastDescription from '../description/ToastDescription.vue';
import ToastRoot from '../root/ToastRoot.vue';
import ToastTitle from '../title/ToastTitle.vue';
import { useToastManager } from '../useToastManager';

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
