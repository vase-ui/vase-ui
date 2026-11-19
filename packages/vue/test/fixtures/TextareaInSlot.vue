<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  field: { type: Object as PropType<Record<string, unknown>>, required: true },
  attrs: Object as PropType<Record<string, unknown>>,
});
const input = useTemplateRef('input');
defineExpose({ input });
</script>

<template>
  <form>
    <TestField :field="field">
      <Input ref="input" v-bind="attrs">
        <template #element="{ props, elementRef, state }">
          <textarea v-bind="props" :ref="elementRef" />
          <output>{{ JSON.stringify(state) }}</output>
        </template>
      </Input>
    </TestField>
  </form>
</template>
