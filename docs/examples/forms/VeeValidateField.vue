<script setup lang="ts">
import { Field as VeeField, useForm } from 'vee-validate';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';

useForm({ initialValues: { username: '' } });
</script>

<template>
  <VeeField v-slot="{ componentField, meta, errorMessage }" name="username">
    <Field.Root
      :name="componentField.name"
      :invalid="!!errorMessage"
      :touched="meta.touched"
      :dirty="meta.dirty"
    >
      <Field.Label>Username</Field.Label>
      <Field.Description>
        May appear where you contribute or are mentioned. You can remove it at any time.
      </Field.Description>
      <Input
        placeholder="e.g. alice132"
        :model-value="componentField.modelValue"
        @update:model-value="componentField['onUpdate:modelValue']"
        @blur="componentField.onBlur"
      />
      <Field.Error :match="!!errorMessage">{{ errorMessage }}</Field.Error>
    </Field.Root>
  </VeeField>
</template>
