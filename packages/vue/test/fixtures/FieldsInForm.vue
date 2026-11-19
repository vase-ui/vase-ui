<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Input } from '../../src/input';
import TestForm from './TestForm.vue';

defineProps({
  form: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  fields: {
    type: Array as PropType<{ root?: Record<string, unknown>; input?: Record<string, unknown> }[]>,
    required: true,
  },
});
</script>

<template>
  <TestForm v-bind="form">
    <Field.Root v-for="(field, index) in fields" :key="index" v-bind="field.root">
      <Field.Label>Field {{ index }}</Field.Label>
      <Input v-bind="field.input" />
      <Field.Error />
    </Field.Root>
  </TestForm>
</template>
