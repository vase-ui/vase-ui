<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// A dialog with its trigger `Open` between the inputs `outside-before` and `outside-target`. Its
// popup has the inputs `inside-1` and `inside-2` and the button `Close`. A modal dialog has a
// backdrop.
defineProps({
  modal: { type: [Boolean, String] as PropType<boolean | 'trap-focus'>, default: true },
  popup: Object as PropType<Record<string, unknown>>,
  portal: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <input data-testid="outside-before" aria-label="Before" />
  <Dialog.Root :modal="modal">
    <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
    <Dialog.Portal v-bind="portal">
      <Dialog.Backdrop v-if="modal" style="position: fixed; inset: 0" />
      <Dialog.Popup
        data-testid="popup"
        style="position: fixed; left: 200px; top: 100px"
        v-bind="popup"
      >
        <input data-testid="inside-1" aria-label="Inside 1" />
        <input data-testid="inside-2" aria-label="Inside 2" />
        <Dialog.Close data-testid="close">Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <input data-testid="outside-target" aria-label="Target" />
</template>
