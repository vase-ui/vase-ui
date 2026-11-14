<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';

// The page makes the handle in `setup`, so a request does not share it with another request.
const handle = AlertDialog.createHandle<string>();
</script>

<template>
  <main>
    <AlertDialog.Root>
      <AlertDialog.Trigger data-testid="closed">Closed</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Popup data-testid="closed-popup">Closed popup</AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
    <AlertDialog.Root default-open default-trigger-id="open-trigger">
      <AlertDialog.Trigger id="open-trigger" data-testid="open">Open</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop data-testid="open-backdrop" />
        <AlertDialog.Popup data-testid="open-popup">
          <AlertDialog.Title data-testid="open-title">Discard draft?</AlertDialog.Title>
          <AlertDialog.Description data-testid="open-description">
            You can't undo this action.
          </AlertDialog.Description>
          <AlertDialog.Close data-testid="open-close">Cancel</AlertDialog.Close>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
    <AlertDialog.Trigger id="detached-trigger" :handle="handle" payload="Detached payload" data-testid="detached">
      Detached
    </AlertDialog.Trigger>
    <AlertDialog.Root :handle="handle">
      <template #default="{ payload }">
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="detached-popup">{{ payload }}</AlertDialog.Popup>
        </AlertDialog.Portal>
      </template>
    </AlertDialog.Root>
  </main>
</template>
