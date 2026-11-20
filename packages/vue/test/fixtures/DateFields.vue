<script setup lang="ts">
import type { PropType } from 'vue';
import { DateField } from '../../src/date-field';

defineProps({
  fields: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  formAttrs: Object as PropType<Record<string, unknown>>,
  /** Renders `DateField.Clear` with this text. */
  clear: String,
});
</script>

<template>
  <form v-bind="formAttrs">
    <DateField.Root v-for="(field, index) in fields" :key="index" v-bind="field">
      <DateField.Input />
      <DateField.Clear v-if="clear" aria-label="Clear">{{ clear }}</DateField.Clear>
    </DateField.Root>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
