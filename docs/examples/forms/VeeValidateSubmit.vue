<script setup lang="ts">
import { useForm } from 'vee-validate';
import { useTemplateRef } from 'vue';

interface FormValues {
  username: string;
  email: string;
}

const { handleSubmit } = useForm<FormValues>();

async function submitForm(data: FormValues) {
  // Change the object, or send it to a server.
  await fetch('https://api.example.com/users', { method: 'POST', body: JSON.stringify(data) });
}

const formElement = useTemplateRef('formElement');

const onSubmit = handleSubmit(submitForm, ({ errors }) => {
  const [name] = Object.keys(errors);
  formElement.value?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
});
</script>

<template>
  <form ref="formElement" novalidate @submit="onSubmit">
    <!-- form fields -->
    <button type="submit">Submit</button>
  </form>
</template>
