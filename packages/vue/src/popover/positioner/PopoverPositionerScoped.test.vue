<script setup lang="ts">
import type { Directive } from 'vue';
import * as Popover from '../index.parts';

withDefaults(defineProps<{ shown?: boolean }>(), { shown: true });

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Popover.Root default-open modal>
    <Popover.Portal>
      <Popover.Positioner
        v-show="shown"
        v-mark="'marked'"
        class="positioner"
        data-testid="positioner"
      >
        <Popover.Popup />
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>

<style scoped>
.positioner {
  outline-style: dashed;
}
</style>
