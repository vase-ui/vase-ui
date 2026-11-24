<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { ScrollArea } from '../../src/scroll-area';

// A scroll area of the page that holds a control, a dialog that stays mounted and whose body is a
// scroll area that holds a field, and a modal dialog. `extra` adds a control to a scroll area.
// `fieldInDialog: false` removes the field. `lateArea` mounts a second scroll area of the page.
defineProps({
  scene: {
    type: Object as PropType<{
      extraOnPage?: boolean;
      extraInDialog?: boolean;
      fieldInDialog?: boolean;
      lateArea?: boolean;
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <button type="button" class="before">Before</button>
  <ScrollArea.Root style="width: 200px; height: 100px">
    <ScrollArea.Viewport class="page-viewport" style="width: 100%; height: 100%">
      <button type="button" class="page-control">Page control</button>
      <button v-if="scene.extraOnPage" type="button">Extra</button>
      <div style="height: 1000px" />
    </ScrollArea.Viewport>
  </ScrollArea.Root>
  <ScrollArea.Root v-if="scene.lateArea" style="width: 200px; height: 100px">
    <ScrollArea.Viewport class="late-viewport" style="width: 100%; height: 100%">
      <button type="button">Late control</button>
      <div style="height: 1000px" />
    </ScrollArea.Viewport>
  </ScrollArea.Root>
  <Dialog.Root>
    <Dialog.Trigger class="kept-trigger">Edit</Dialog.Trigger>
    <Dialog.Portal keep-mounted>
      <Dialog.Popup aria-label="Edit">
        <ScrollArea.Root style="width: 200px; height: 100px">
          <ScrollArea.Viewport class="kept-viewport" style="width: 100%; height: 100%">
            <input v-if="scene.fieldInDialog !== false" class="first" aria-label="First" />
            <input v-if="scene.extraInDialog" aria-label="Second" />
            <div style="height: 1000px" />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Dialog.Root>
    <Dialog.Trigger class="modal-trigger">Settings</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup class="modal" aria-label="Settings">
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
