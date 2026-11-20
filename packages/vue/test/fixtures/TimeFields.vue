<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { TimeField } from '../../src/time-field';

defineProps({
  fields: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  formAttrs: Object as PropType<Record<string, unknown>>,
  /** Renders `TimeField.Clear` with this text. */
  clear: String,
});
const roots = useTemplateRef('roots');
defineExpose({ roots });
</script>

<template>
  <form v-bind="formAttrs">
    <TimeField.Root v-for="(field, index) in fields" ref="roots" :key="index" v-bind="field">
      <TimeField.Input />
      <TimeField.Clear v-if="clear" aria-label="Clear">{{ clear }}</TimeField.Clear>
    </TimeField.Root>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
