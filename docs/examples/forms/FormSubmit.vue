<script setup lang="ts">
import { Form } from '@vase-ui/vue/form';

async function onFormSubmit(formValues: Record<string, unknown>) {
  const payload = {
    product_id: formValues.id,
    order_quantity: formValues.quantity,
  };
  await fetch('https://api.example.com', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
</script>

<template>
  <Form @form-submit="onFormSubmit" />
</template>
