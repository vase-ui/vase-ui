<script setup lang="ts">
import type { PropType } from 'vue';
import { Input } from '../../src/input';
import TestField from './TestField.vue';

defineProps({
  inputs: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  field: Object as PropType<Record<string, unknown>>,
  formAttrs: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <form v-bind="formAttrs">
    <TestField :field="field">
      <Input v-for="(attrs, index) in inputs" :key="index" v-bind="attrs" />
    </TestField>
    <button type="reset">Reset</button>
  </form>
  <form>
    <input name="other" value="other" />
  </form>
</template>
