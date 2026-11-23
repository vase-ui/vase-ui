<script setup lang="ts">
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from 'reka-ui';

const { toasts } = useToastManager();
</script>

<template>
  <ToastRoot
    v-for="toast in toasts"
    :key="toast.id"
    :toast="toast"
    class="bench-toast"
    data-bench="toast"
  >
    <div class="bench-toast-content">
      <div class="bench-toast-text">
        <ToastTitle class="bench-toast-title" />
        <ToastDescription class="bench-toast-description" />
      </div>
      <ToastAction data-bench="toast-action" />
      <ToastClose data-bench="toast-close">Close</ToastClose>
    </div>
  </ToastRoot>
  <ToastViewport class="bench-toast-viewport" />
</template>
