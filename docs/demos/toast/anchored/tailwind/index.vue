<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import AnchoredToasts from './AnchoredToasts.vue';
import { anchoredToastManager } from './anchoredToastManager';
import CopyButton from './CopyButton.vue';
</script>

<template>
  <Toast.Provider :toast-manager="anchoredToastManager">
    <AnchoredToasts />
    <CopyButton />
  </Toast.Provider>
</template>
