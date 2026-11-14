<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const toastManager = Toast.useToastManager();

function action() {
  const id = toastManager.add({
    title: 'Action performed',
    description: 'You can undo this action.',
    type: 'success',
    timeout: 10000,
    actionProps: {
      children: 'Undo',
      onClick() {
        toastManager.close(id);
        toastManager.add({
          title: 'Action undone',
        });
      },
    },
  });
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="action">Perform action</button>
</template>
