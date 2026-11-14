<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const toastManager = Toast.useToastManager();

function addToast() {
  toastManager.add({
    description: 'Hello, world!',
  });
}
</script>

<template>
  <button type="button" @click="addToast">Add toast</button>
</template>
