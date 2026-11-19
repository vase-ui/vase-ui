<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Input } from '../../src/input';
import StyledInput from './StyledInput.vue';

defineProps({ attrs: Object as PropType<Record<string, unknown>> });
const input = useTemplateRef('input');
defineExpose({ input });
</script>

<template>
  <Input ref="input" v-bind="attrs">
    <template #element="{ props, elementRef }">
      <StyledInput v-bind="props" :ref="elementRef" />
    </template>
  </Input>
</template>
