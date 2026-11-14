<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const toastManager = Toast.useToastManager();

function runPromise() {
  toastManager.promise(
    // Simulate an API request with a promise that resolves after 2 seconds
    new Promise<string>((resolve, reject) => {
      const shouldSucceed = Math.random() > 0.3; // 70% success rate
      setTimeout(() => {
        if (shouldSucceed) {
          resolve('operation completed');
        } else {
          reject(new Error('operation failed'));
        }
      }, 2000);
    }),
    {
      loading: 'Loading data…',
      success: (data: string) => `Success: ${data}`,
      error: (err: Error) => `Error: ${err.message}`,
    },
  );
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="runPromise">Run promise</button>
</template>
