<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const { toasts } = Toast.useToastManager();

function pulseClass(toast: Toast.Root.ToastObject) {
  // New toasts start with `updateKey: 0`, so the first add skips the replay pulse.
  if (!toast.updateKey) {
    return null;
  }
  return toast.updateKey % 2 === 0 ? styles.PulseEven : styles.PulseOdd;
}
</script>

<template>
  <Toast.Root
    v-for="toast in toasts"
    :key="toast.id"
    :toast="toast"
    :class="[styles.Toast, pulseClass(toast)]"
  >
    <Toast.Content :class="styles.Content">
      <div :class="styles.Text">
        <Toast.Title :class="styles.Title" />
        <Toast.Description :class="styles.Description" />
      </div>
      <Toast.Close :class="styles.Close">Dismiss</Toast.Close>
    </Toast.Content>
  </Toast.Root>
</template>
