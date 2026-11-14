<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

// The page makes the handle in `setup`, so a request does not share it with another request.
const handle = Dialog.createHandle();
</script>

<template>
  <main>
    <Dialog.Root>
      <Dialog.Trigger data-testid="closed">Closed</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="closed-popup">
          <Dialog.Title>Closed title</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root default-open default-trigger-id="open-trigger" :modal="false">
      <Dialog.Trigger id="open-trigger" data-testid="open">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="open-popup">
          <Dialog.Title data-testid="open-title">Open title</Dialog.Title>
          <Dialog.Description data-testid="open-description">Open description</Dialog.Description>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Trigger :handle="handle" data-testid="detached">Detached</Dialog.Trigger>
    <Dialog.Root :handle="handle">
      <Dialog.Portal>
        <Dialog.Popup data-testid="detached-popup">Detached popup</Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </main>
</template>
