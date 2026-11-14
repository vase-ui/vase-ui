<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Root v-for="toast in toasts" :key="toast.id" :toast="toast" :class="styles.Toast">
    <Toast.Content :class="styles.Content">
      <div :class="styles.Text">
        <Toast.Title :class="styles.Title" />
        <Toast.Description :class="styles.Description" />
      </div>
      <Toast.Close :class="styles.Close">Dismiss</Toast.Close>
    </Toast.Content>
  </Toast.Root>
</template>
