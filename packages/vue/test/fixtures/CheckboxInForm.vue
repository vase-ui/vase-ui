<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { Form } from '../../src/form';
import TestField from './TestField.vue';

// A new `scene.key` mounts a new checkbox in the field.
defineProps({
  form: Object as PropType<Record<string, unknown>>,
  field: { type: Object as PropType<Record<string, unknown>>, required: true },
  box: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ key: string }>, default: () => ({ key: 'first' }) },
});
</script>

<template>
  <Form v-bind="form">
    <TestField :field="field">
      <Checkbox :key="scene.key" v-bind="box" />
    </TestField>
    <button type="submit">Submit</button>
  </Form>
</template>
