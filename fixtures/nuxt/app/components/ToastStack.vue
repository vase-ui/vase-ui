<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" data-testid="toast">
    <Toast.Title data-testid="title" />
    <Toast.Description />
    <Toast.Close aria-label="Close" />
  </Toast.Root>
</template>
