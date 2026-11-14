<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const toastManager = Toast.useToastManager();

function createToast() {
  toastManager.add({
    id: 'save-status',
    title: 'Draft saved',
    description: 'Click again while it is visible to replay the pulse.',
  });
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="createToast">Save draft</button>
</template>
