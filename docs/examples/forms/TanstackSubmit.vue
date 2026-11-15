<script setup lang="ts">
import { useForm } from '@tanstack/vue-form';
import { useTemplateRef } from 'vue';

const formElement = useTemplateRef('formElement');

const form = useForm({
  defaultValues: { username: '' },
  onSubmit: async ({ value: formValues }) => {
    await fetch('https://api.example.com/users', {
      method: 'POST',
      body: JSON.stringify(formValues),
    });
  },
  onSubmitInvalid: () => {
    formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  },
});
</script>

<template>
  <form ref="formElement" @submit.prevent="form.handleSubmit()">
    <!-- form fields -->
    <button type="submit">Submit</button>
  </form>
</template>
