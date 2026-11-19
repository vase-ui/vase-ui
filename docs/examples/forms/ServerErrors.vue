<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form } from '@vase-ui/vue/form';

async function submitToServer() {
  return {
    errors: {
      promoCode: 'This promo code has expired',
    },
  };
}

const errors = ref<Record<string, string | string[]>>();

async function onSubmit() {
  const response = await submitToServer();
  errors.value = response.errors;
}
</script>

<template>
  <Form v-model:errors="errors" @submit.prevent="onSubmit">
    <Field.Root name="promoCode">
      <Input />
      <Field.Error />
    </Field.Root>
  </Form>
</template>
