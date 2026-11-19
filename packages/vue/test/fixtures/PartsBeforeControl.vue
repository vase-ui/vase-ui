<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';
import TestForm from './TestForm.vue';

defineProps({ root: Object, errors: Object });
</script>

<template>
  <TestForm :errors="errors">
    <Field.Root v-bind="root">
      <Field.Description id="first">First.</Field.Description>
      <Field.Error id="error" />
      <Field.Label>Name</Field.Label>
      <Input name="name" />
      <Field.Description id="last">Last.</Field.Description>
    </Field.Root>
  </TestForm>
</template>
