<script setup lang="ts">
import { Dialog, useDialog } from '@ark-ui/vue/dialog';
import { ref } from 'vue';
import '../../../behavior/style.css';

const parentDialog = useDialog();
const childDialog = useDialog();
const pageCount = ref(0);
const dialogCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="page-action" @click="pageCount++">Page action</button>
    <span data-bench="page-count">{{ pageCount }}</span>
    <button type="button" data-bench="dialog-1-trigger" @click="parentDialog.setOpen(true)">
      Open dialog 1
    </button>
  </div>

  <Dialog.RootProvider :value="parentDialog">
    <Teleport to="body">
      <Dialog.Backdrop class="bench-backdrop" />
      <Dialog.Positioner>
        <Dialog.Content data-bench="dialog-1">
          <div class="bench-corner">
            <button type="button" data-bench="dialog-1-action" @click="dialogCount++">
              Dialog 1 action
            </button>
            <span data-bench="dialog-1-count">{{ dialogCount }}</span>
          </div>
          <Dialog.Title>Dialog 1</Dialog.Title>
          <Dialog.Description>Description 1</Dialog.Description>
          <button type="button" data-bench="dialog-2-trigger" @click="childDialog.setOpen(true)">
            Open dialog 2
          </button>
          <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Teleport>
  </Dialog.RootProvider>

  <Dialog.RootProvider :value="childDialog">
    <Teleport to="body">
      <Dialog.Backdrop class="bench-backdrop" />
      <Dialog.Positioner>
        <Dialog.Content data-bench="dialog-2">
          <Dialog.Title>Dialog 2</Dialog.Title>
          <Dialog.Description>Description 2</Dialog.Description>
          <button type="button" data-bench="dialog-2-action">Dialog 2 action</button>
          <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Teleport>
  </Dialog.RootProvider>
</template>

<style>
[data-scope='dialog'][data-part='content'][data-state='open'] {
  animation: bench-enter var(--bench-duration) linear;
}

[data-scope='dialog'][data-part='content'][data-state='closed'] {
  animation: bench-exit var(--bench-duration) linear;
}
</style>
