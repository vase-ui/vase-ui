<script setup lang="ts">
import { ToastProvider } from '../../components/toast';
import TanstackForm from './TanstackForm.vue';
</script>

<template>
  <ToastProvider>
    <TanstackForm />
  </ToastProvider>
</template>
