<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate';
import { Field } from '@vase-ui/vue/field';

useForm({ initialValues: { username: '' } });

function validateUsername(value: unknown) {
  if (typeof value !== 'string' || value === '') {
    return 'This is a required field.';
  }
  if (value.length < 2) {
    return 'Too short';
  }
  return true;
}
</script>

<template>
  <VeeField
    v-slot="{ field, value, meta, errorMessage, handleChange, handleBlur }"
    name="username"
    :rules="validateUsername"
  >
    <Field.Root
      :name="field.name"
      :invalid="!!errorMessage"
      :touched="meta.touched"
      :dirty="meta.dirty"
    >
      <Field.Label>Username</Field.Label>
      <Field.Control :value="value" @update:value="handleChange" @blur="handleBlur" />
      <Field.Error :match="!!errorMessage">{{ errorMessage }}</Field.Error>
    </Field.Root>
  </VeeField>
</template>
