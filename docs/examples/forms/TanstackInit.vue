<script setup lang="ts">
import { useForm } from '@tanstack/vue-form';

// #region init
interface FormValues {
  username: string;
  email: string;
}

const defaultValues: FormValues = {
  username: '',
  email: '',
};

const form = useForm({
  defaultValues,
});
// #endregion init
</script>

<template>
  <form @submit.prevent="form.handleSubmit()" />
</template>
