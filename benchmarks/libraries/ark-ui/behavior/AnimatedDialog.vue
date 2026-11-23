<script setup lang="ts">
import { Dialog } from '@ark-ui/vue/dialog';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
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
  </div>
</template>

<style>
[data-scope='dialog'][data-part='content'][data-state='open'] {
  animation: bench-enter var(--bench-duration) linear;
}

[data-scope='dialog'][data-part='content'][data-state='closed'] {
  animation: bench-exit var(--bench-duration) linear;
}
</style>
