<script setup lang="ts">
import { ToastProvider } from '../../components/toast';
import VeeValidateForm from './VeeValidateForm.vue';
</script>

<template>
  <ToastProvider aria-label="VeeValidate notifications">
    <VeeValidateForm />
  </ToastProvider>
</template>
