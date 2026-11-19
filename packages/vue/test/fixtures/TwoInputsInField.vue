<script setup lang="ts">
import type { PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  field: { type: Object as PropType<Record<string, unknown>>, required: true },
  shown: { type: Object as PropType<{ first: boolean; second: boolean }>, required: true },
});
</script>

<template>
  <TestField :field="field">
    <Input v-if="shown.first" id="first" />
    <Input v-if="shown.second" id="second" />
  </TestField>
</template>
