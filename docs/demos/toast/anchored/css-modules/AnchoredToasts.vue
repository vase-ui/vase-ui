<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Portal>
    <Toast.Viewport :class="styles.Viewport">
      <Toast.Positioner
        v-for="toast in toasts"
        :key="toast.id"
        :toast="toast"
        :class="styles.Positioner"
      >
        <Toast.Root :toast="toast" :class="styles.Toast">
          <Toast.Content>
            <Toast.Description :class="styles.Description" />
          </Toast.Content>
        </Toast.Root>
      </Toast.Positioner>
    </Toast.Viewport>
  </Toast.Portal>
</template>
