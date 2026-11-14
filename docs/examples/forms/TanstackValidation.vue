<script setup lang="ts">
import { revalidateLogic, useForm } from '@tanstack/vue-form';

const form = useForm({
  defaultValues: {
    username: '',
    email: '',
  },
  validationLogic: revalidateLogic({
    mode: 'submit',
    modeAfterSubmission: 'change',
  }),
  validators: {
    onDynamic: ({ value: formValues }) => {
      const errors: { username?: string; email?: string } = {};

      if (!formValues.username) {
        errors.username = 'Username is required.';
      } else if (formValues.username.length < 3) {
        errors.username = 'At least 3 characters.';
      }

      if (!formValues.email) {
        errors.email = 'Email is required.';
      } else if (!formValues.email.includes('@')) {
        errors.email = 'Invalid email address.';
      }

      return { form: errors, fields: errors };
    },
  },
});
</script>

<template>
  <form @submit.prevent="form.handleSubmit()" />
</template>
