<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  inputs: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  field: Object as PropType<Record<string, unknown>>,
});
const inputRefs = useTemplateRef('input');
defineExpose({ inputRefs });
</script>

<template>
  <TestField :field="field">
    <Input v-for="(attrs, index) in inputs" :key="index" ref="input" v-bind="attrs" />
  </TestField>
</template>
