<script setup lang="ts">
import type { PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';
import TestForm from './TestForm.vue';

defineProps({
  form: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ shown: boolean }>, required: true },
  attrs: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <TestForm v-bind="form">
    <KeepAlive>
      <TestField v-if="scene.shown" :field="{}">
        <Input v-bind="attrs" />
      </TestField>
      <p v-else>Other</p>
    </KeepAlive>
  </TestForm>
</template>
