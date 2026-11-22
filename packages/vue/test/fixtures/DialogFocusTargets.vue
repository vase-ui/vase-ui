<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Drawer } from '../../src/drawer';
import DialogFocusTargetsPopup from './DialogFocusTargetsPopup.vue';

// A dialog with its trigger `Open` between the inputs `outside-before` and `outside-target`. Its
// popup has the inputs `inside-1` and `inside-2` and the button `Close`. A modal dialog has a
// backdrop. With `drawer`, the parts are those of Drawer, with the popup in `Drawer.Viewport`.
defineProps({
  modal: { type: [Boolean, String] as PropType<boolean | 'trap-focus'>, default: true },
  popup: Object as PropType<Record<string, unknown>>,
  portal: Object as PropType<Record<string, unknown>>,
  drawer: Boolean,
});
</script>

<template>
  <input data-testid="outside-before" aria-label="Before" />
  <Drawer.Root v-if="drawer" :modal="modal">
    <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
    <Drawer.Portal v-bind="portal">
      <Drawer.Backdrop v-if="modal" style="position: fixed; inset: 0" />
      <Drawer.Viewport>
        <DialogFocusTargetsPopup :parts="Drawer" :popup="popup" />
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
  <Dialog.Root v-else :modal="modal">
    <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
    <Dialog.Portal v-bind="portal">
      <Dialog.Backdrop v-if="modal" style="position: fixed; inset: 0" />
      <DialogFocusTargetsPopup :parts="Dialog" :popup="popup" />
    </Dialog.Portal>
  </Dialog.Root>
  <input data-testid="outside-target" aria-label="Target" />
</template>
