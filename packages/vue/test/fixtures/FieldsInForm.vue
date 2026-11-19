<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Input } from '../../src/input';

defineProps({
  form: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  fields: {
    type: Array as PropType<
      // An `input` of `null` gives a field with no control.
      { key?: string; root?: Record<string, unknown>; input?: Record<string, unknown> | null }[]
    >,
    required: true,
  },
  // A native input before the fields.
  native: Object as PropType<Record<string, unknown>>,
});
const formPart = useTemplateRef('formPart');
defineExpose({ form: formPart });
</script>

<template>
  <Form ref="formPart" v-bind="form">
    <input v-if="native" v-bind="native" />
    <Field.Root v-for="(field, index) in fields" :key="field.key ?? index" v-bind="field.root">
      <Field.Label>Field {{ field.key ?? index }}</Field.Label>
      <Input v-if="field.input !== null" v-bind="field.input" />
      <Field.Error />
    </Field.Root>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </Form>
</template>
