<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import TestField from './TestField.vue';

defineProps({
  field: { type: Object as PropType<Record<string, unknown>>, required: true },
  box: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <form>
    <TestField :field="field">
      <Checkbox v-bind="box" />
    </TestField>
    <button type="reset">Reset</button>
  </form>
</template>
