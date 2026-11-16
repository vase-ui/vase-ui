<script setup lang="ts">
import { ToastProvider } from '../../components/toast';
import TanstackForm from './TanstackForm.vue';
</script>

<template>
  <ToastProvider aria-label="TanStack Form notifications">
    <TanstackForm />
  </ToastProvider>
</template>
