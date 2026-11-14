<script setup lang="ts">
import type { Directive } from 'vue';
import * as Select from '../index.parts';

withDefaults(defineProps<{ shown?: boolean }>(), { shown: true });

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Select.Root default-open>
    <Select.Trigger />
    <Select.Portal>
      <Select.Positioner
        v-show="shown"
        v-mark="'marked'"
        class="positioner"
        data-testid="positioner"
      >
        <Select.Popup />
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>

<style scoped>
.positioner {
  outline-style: dashed;
}
</style>
