<script setup lang="ts">
import { ToastProvider } from '../../components/toast';
import ExampleForm from './ExampleForm.vue';
</script>

<template>
  <ToastProvider>
    <ExampleForm />
  </ToastProvider>
</template>
