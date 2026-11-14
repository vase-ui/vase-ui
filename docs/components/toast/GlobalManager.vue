<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const toastManager = Toast.createToastManager();
</script>

<template>
  <Toast.Provider :toast-manager="toastManager">
    <!-- The content of the app -->
  </Toast.Provider>
</template>
