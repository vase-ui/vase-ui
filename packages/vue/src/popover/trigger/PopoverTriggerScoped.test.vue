<script setup lang="ts">
import type { Directive } from 'vue';
import * as Popover from '../index.parts';

withDefaults(defineProps<{ open?: boolean; modal?: boolean; shown?: boolean }>(), {
  open: false,
  modal: false,
  shown: true,
});

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <Popover.Root :open="open" trigger-id="trigger" :modal="modal">
    <Popover.Trigger
      id="trigger"
      v-show="shown"
      v-mark="'marked'"
      class="trigger"
      data-testid="trigger"
    >
      Toggle
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup>
          <Popover.Close>Close</Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>

<style scoped>
.trigger {
  outline-style: dashed;
}
</style>
