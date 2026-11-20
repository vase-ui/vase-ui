<script setup lang="ts">
import { h } from 'vue';
import { Toast } from '../../src/toast';

const manager = Toast.useToastManager();
manager.add({
  id: 'a',
  title: () => h('strong', 'Bold'),
  description: 'Saved',
  priority: 'high',
  timeout: 0,
});
manager.add({ id: 'b', title: 'Plain', timeout: 0 });
</script>

<template>
  <Toast.Viewport aria-label="Notifications">
    <Toast.Root
      v-for="toast in manager.toasts.value"
      :key="toast.id"
      :toast="toast"
      :data-id="toast.id"
    >
      <Toast.Content>
        <Toast.Title />
        <Toast.Description />
        <Toast.Close>Close</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  </Toast.Viewport>
</template>
