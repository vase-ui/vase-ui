<script setup lang="ts">
import type { PropType } from 'vue';
import { Form } from '../../src/form';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  form: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ shown: boolean }>, required: true },
  attrs: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Form v-bind="form">
    <KeepAlive>
      <TestField v-if="scene.shown" :field="{}">
        <Input v-bind="attrs" />
      </TestField>
      <p v-else>Other</p>
    </KeepAlive>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </Form>
</template>
