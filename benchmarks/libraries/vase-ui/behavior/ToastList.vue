<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <TransitionGroup enter-from-class="bench-toast-starting" leave-to-class="bench-toast-ending">
    <Toast.Root
      v-for="toast in toasts"
      :key="toast.id"
      :toast="toast"
      class="bench-toast"
      data-bench="toast"
    >
      <Toast.Content class="bench-toast-content">
        <div class="bench-toast-text">
          <Toast.Title class="bench-toast-title" />
          <Toast.Description class="bench-toast-description" />
        </div>
        <Toast.Action data-bench="toast-action" />
        <Toast.Close data-bench="toast-close">Close</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  </TransitionGroup>
</template>
