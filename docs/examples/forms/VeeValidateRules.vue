<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';

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
    v-slot="{ componentField, meta, errorMessage }"
    name="username"
    :rules="validateUsername"
  >
    <Field.Root
      :name="componentField.name"
      :invalid="!!errorMessage"
      :touched="meta.touched"
      :dirty="meta.dirty"
    >
      <Field.Label>Username</Field.Label>
      <Input
        :model-value="componentField.modelValue"
        @update:model-value="componentField['onUpdate:modelValue']"
        @blur="componentField.onBlur"
      />
      <Field.Error :match="!!errorMessage">{{ errorMessage }}</Field.Error>
    </Field.Root>
  </VeeField>
</template>
