<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const toastManager = Toast.useToastManager();
let count = 0;

function createToast() {
  count += 1;
  toastManager.add({
    title: `Toast ${count} created`,
    description: 'This is a toast notification.',
  });
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="createToast">Create toast</button>
</template>
