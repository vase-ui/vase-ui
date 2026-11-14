<script setup lang="ts">
import type { Directive } from 'vue';
import * as Combobox from '../index.parts';

withDefaults(defineProps<{ shown?: boolean }>(), { shown: true });

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Combobox.Root modal default-open>
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner
        v-show="shown"
        v-mark="'marked'"
        class="positioner"
        data-testid="positioner"
      >
        <Combobox.Popup />
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>

<style scoped>
.positioner {
  outline-style: dashed;
}
</style>
