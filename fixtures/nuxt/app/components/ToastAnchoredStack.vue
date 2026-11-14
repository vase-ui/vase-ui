<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Positioner
    v-for="toast in toasts"
    :key="toast.id"
    :toast="toast"
    data-testid="anchored-positioner"
  >
    <Toast.Root :toast="toast">
      <Toast.Arrow data-testid="arrow" />
      <Toast.Title />
    </Toast.Root>
  </Toast.Positioner>
</template>
