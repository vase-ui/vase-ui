<script setup lang="ts">
import type { PropType } from 'vue';
import { Switch } from '../../src/switch';

defineProps({
  switches: { type: Array as PropType<Record<string, unknown>[]>, required: true },
});
</script>

<template>
  <form>
    <label v-for="(attrs, index) in switches" :key="index">
      Switch {{ index }}
      <Switch v-bind="attrs" />
    </label>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
  <form id="other"><input name="other" value="other" /></form>
</template>
