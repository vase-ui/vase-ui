<script setup lang="ts">
import { Toast } from '../../src/toast';
import ToastElementSlotsList from './ToastElementSlotsList.vue';
</script>

<template>
  <input id="toast-before" aria-label="Before" />
  <Toast.Provider>
    <ToastElementSlotsList />
  </Toast.Provider>
</template>
