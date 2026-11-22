<script setup lang="ts">
import type { PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';

type Target = ShadowRoot | HTMLElement | undefined;

// An open dialog whose popup holds a closed dialog of the kind `nested`, with its trigger and its
// close button. `outerTo` and `nestedTo` are the targets of the two portals. With no target, a
// portal renders where the portal above it renders, else in <body>. A modal dialog has a backdrop.
defineProps({
  nested: { type: String as PropType<'modal' | 'not modal' | 'alert'>, required: true },
  outerTo: Object as PropType<Target>,
  nestedTo: Object as PropType<Target>,
  root: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <div data-testid="outside" style="position: fixed; right: 0; bottom: 0">Outside</div>
  <Dialog.Root default-open :modal="nested !== 'not modal'" v-bind="root">
    <Dialog.Portal :to="outerTo">
      <Dialog.Backdrop v-if="nested !== 'not modal'" />
      <Dialog.Popup data-testid="outer">
        <AlertDialog.Root v-if="nested === 'alert'">
          <AlertDialog.Trigger data-testid="open-nested">Open nested</AlertDialog.Trigger>
          <AlertDialog.Portal :to="nestedTo">
            <AlertDialog.Backdrop />
            <AlertDialog.Popup data-testid="nested">
              <AlertDialog.Close data-testid="close-nested">Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
        <Dialog.Root v-else :modal="nested === 'modal'">
          <Dialog.Trigger data-testid="open-nested">Open nested</Dialog.Trigger>
          <Dialog.Portal :to="nestedTo">
            <Dialog.Backdrop v-if="nested === 'modal'" />
            <Dialog.Popup data-testid="nested">
              <Dialog.Close data-testid="close-nested">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
