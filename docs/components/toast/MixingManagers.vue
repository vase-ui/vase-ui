<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const anchoredToastManager = Toast.createToastManager();
const stackedToastManager = Toast.createToastManager();
</script>

<template>
  <Toast.Provider :toast-manager="anchoredToastManager">
    <!-- The anchored toasts -->
  </Toast.Provider>
  <Toast.Provider :toast-manager="stackedToastManager">
    <!-- The stacked toasts -->
  </Toast.Provider>

  <!-- The content of the app -->
</template>
