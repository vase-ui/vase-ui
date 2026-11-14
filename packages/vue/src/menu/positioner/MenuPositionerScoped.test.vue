<script setup lang="ts">
import type { Directive } from 'vue';
import * as Menu from '../index.parts';

withDefaults(defineProps<{ shown?: boolean }>(), { shown: true });

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Menu.Root default-open>
    <Menu.Portal>
      <Menu.Positioner v-show="shown" v-mark="'marked'" class="positioner" data-testid="positioner">
        <Menu.Popup />
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>

<style scoped>
.positioner {
  outline-style: dashed;
}
</style>
