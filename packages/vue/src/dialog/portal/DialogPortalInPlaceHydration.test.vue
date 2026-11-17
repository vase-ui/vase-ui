<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

defineProps<{ modal: boolean }>();
</script>

<template>
  <div data-testid="host">
    <button data-testid="before" type="button">before</button>
    <Dialog.Root default-open :modal="modal">
      <Dialog.Portal disabled data-testid="portal">
        <Dialog.Backdrop data-testid="backdrop" />
        <Dialog.Popup data-testid="popup">
          <Dialog.Title data-testid="title">Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <button data-testid="after" type="button">after</button>
  </div>
</template>
