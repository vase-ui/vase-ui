<script setup lang="ts">
import { Dialog } from '../../src/dialog';
import { Drawer } from '../../src/drawer';

// A drawer in the popup of a dialog. The popup has a place, so it is above the fixed element of the
// modal dialog.
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <Dialog.Backdrop data-testid="dialog-backdrop" />
      <Dialog.Viewport>
        <Dialog.Popup data-testid="dialog-popup" style="position: relative">
          <Drawer.Root>
            <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Backdrop data-testid="backdrop" />
              <Drawer.Viewport data-testid="viewport">
                <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>
