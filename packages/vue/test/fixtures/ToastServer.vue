<script setup lang="ts">
import { Toast } from '../../src/toast';
import ToastServerList from './ToastServerList.vue';

// A setup adds two toasts: one of high priority with a title that is a function. The viewport is in
// place, or in a portal with `portal`.
defineProps({ portal: Boolean });
</script>

<template>
  <Toast.Provider>
    <Toast.Portal v-if="portal">
      <ToastServerList />
    </Toast.Portal>
    <ToastServerList v-else />
  </Toast.Provider>
</template>
