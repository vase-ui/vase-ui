<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';

defineProps({
  boxes: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  formAttrs: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <form v-bind="formAttrs">
    <label v-for="(box, index) in boxes" :key="index">
      Box {{ index }}
      <Checkbox v-bind="box" />
    </label>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
  <form id="other"><input name="other" value="other" /></form>
</template>
