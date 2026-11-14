<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import type { CustomToastData } from './CustomToastData';
import styles from './index.module.css';

const toastManager = Toast.useToastManager();

function action() {
  const data: CustomToastData = {
    userId: '123',
  };

  toastManager.add({
    title: 'Toast with custom data',
    data,
  });
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="action">Create custom toast</button>
</template>
