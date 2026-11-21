<script setup lang="ts">
import { Dialog } from '@ark-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger data-bench="trigger">Open</Dialog.Trigger>
    <Teleport to="body">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content data-bench="popup">
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Teleport>
  </Dialog.Root>
</template>
