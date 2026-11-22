<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// Three dialogs, each in the popup of the one before. Dialog `n` has the trigger `open-n`, the
// popup `popup-n` and the close button `close-n`; the first dialog has the backdrop `backdrop-0`.
// `scene.closed` mounts a closed dialog in the first popup after the second dialog.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ closed?: boolean }>, default: () => ({}) },
});
const POPUP_STYLE = 'position: fixed; left: 200px; top: 100px';
</script>

<template>
  <Dialog.Root v-bind="root">
    <Dialog.Trigger data-testid="open-0">Open 0</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop data-testid="backdrop-0" style="position: fixed; inset: 0" />
      <Dialog.Popup data-testid="popup-0" :style="POPUP_STYLE">
        <Dialog.Root>
          <Dialog.Trigger data-testid="open-1">Open 1</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup-1" :style="POPUP_STYLE">
              <Dialog.Root>
                <Dialog.Trigger data-testid="open-2">Open 2</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="popup-2" :style="POPUP_STYLE">
                    <Dialog.Close data-testid="close-2">Close 2</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
              <Dialog.Close data-testid="close-1">Close 1</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <Dialog.Root v-if="scene.closed">
          <Dialog.Portal>
            <Dialog.Popup data-testid="closed-popup">Closed</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <Dialog.Close data-testid="close-0">Close 0</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
