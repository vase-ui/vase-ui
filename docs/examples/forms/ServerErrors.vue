<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';

async function submitToServer() {
  return {
    errors: {
      promoCode: 'This promo code has expired',
    },
  };
}

const errors = ref<Record<string, string | string[]>>();

async function onFormSubmit() {
  const response = await submitToServer();
  errors.value = response.errors;
}
</script>

<template>
  <Form :errors="errors" @form-submit="onFormSubmit">
    <Field.Root name="promoCode">
      <Field.Control />
      <Field.Error />
    </Field.Root>
  </Form>
</template>
