<script setup lang="ts">
import type { Directive } from 'vue';
import * as Menu from '../index.parts';

withDefaults(defineProps<{ open?: boolean; shown?: boolean }>(), { open: false, shown: true });

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Menu.Root :open="open" trigger-id="trigger" :modal="false">
    <Menu.Trigger
      id="trigger"
      v-show="shown"
      v-mark="'marked'"
      class="trigger"
      data-testid="trigger"
    >
      Toggle
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup />
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>

<style scoped>
.trigger {
  outline-style: dashed;
}
</style>
