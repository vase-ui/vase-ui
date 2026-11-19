<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({
  root: Object as PropType<Record<string, unknown>>,
  label: Object as PropType<Record<string, unknown>>,
  input: Object as PropType<Record<string, unknown>>,
  description: Object as PropType<Record<string, unknown>>,
  errors: { type: Array as PropType<Record<string, unknown>[]>, default: () => [{}] },
  shown: {
    type: Object as PropType<{ input?: boolean; description?: boolean }>,
    default: () => ({}),
  },
});
const field = useTemplateRef('field');
defineExpose({ field });
</script>

<template>
  <Field.Root ref="field" v-bind="root">
    <Field.Label v-bind="label">Name</Field.Label>
    <Input v-if="shown.input !== false" v-bind="input" />
    <Field.Description v-if="shown.description !== false" v-bind="description">
      Your full name.
    </Field.Description>
    <Field.Error v-for="(error, index) in errors" :key="index" v-bind="error" />
  </Field.Root>
</template>
