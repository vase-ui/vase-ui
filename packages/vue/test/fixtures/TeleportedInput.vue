<script setup lang="ts">
import type { PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  field: { type: Object as PropType<Record<string, unknown>>, required: true },
  target: { type: Object as PropType<Element>, required: true },
});
</script>

<template>
  <TestField :field="field">
    <Teleport :to="target">
      <Input />
    </Teleport>
  </TestField>
</template>
