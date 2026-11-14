<script setup lang="ts">
import { useForm } from '@tanstack/vue-form';

const form = useForm({
  defaultValues: { username: '' },
  onSubmit: async ({ value: formValues }) => {
    await fetch('https://api.example.com/users', {
      method: 'POST',
      body: JSON.stringify(formValues),
    });
  },
});
</script>

<template>
  <form @submit.prevent="form.handleSubmit()">
    <!-- form fields -->
    <button type="submit">Submit</button>
  </form>
</template>
