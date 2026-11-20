<script setup lang="ts">
import { Toast } from '../../src/toast';

const manager = Toast.useToastManager();
defineExpose({ manager });
</script>

<template>
  <Toast.Viewport aria-label="Notifications">
    <Toast.Root
      v-for="toast in manager.toasts.value"
      :key="toast.id"
      :toast="toast"
      :data-id="toast.id"
    >
      <Transition name="description">
        <Toast.Description />
      </Transition>
    </Toast.Root>
  </Toast.Viewport>
</template>
