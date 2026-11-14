<script setup lang="ts">
import { useForm } from 'vee-validate';

interface FormValues {
  username: string;
  email: string;
}

const { handleSubmit } = useForm<FormValues>();

async function submitForm(data: FormValues) {
  // transform the object and/or submit it to a server
  await fetch('https://api.example.com/users', { method: 'POST', body: JSON.stringify(data) });
}

const onSubmit = handleSubmit(submitForm);
</script>

<template>
  <form novalidate @submit="onSubmit">
    <!-- form fields -->
    <button type="submit">Submit</button>
  </form>
</template>
