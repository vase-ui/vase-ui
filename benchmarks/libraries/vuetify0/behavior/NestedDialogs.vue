<script setup lang="ts">
import { Dialog } from '@vuetify/v0';
import { ref } from 'vue';
import '../../../behavior/style.css';

const pageCount = ref(0);
const dialogCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="page-action" @click="pageCount++">Page action</button>
    <span data-bench="page-count">{{ pageCount }}</span>
    <Dialog.Root>
      <Dialog.Activator data-bench="dialog-1-trigger">Open dialog 1</Dialog.Activator>
      <Dialog.Content data-bench="dialog-1">
        <div class="bench-corner">
          <button type="button" data-bench="dialog-1-action" @click="dialogCount++">
            Dialog 1 action
          </button>
          <span data-bench="dialog-1-count">{{ dialogCount }}</span>
        </div>
        <Dialog.Title>Dialog 1</Dialog.Title>
        <Dialog.Description>Description 1</Dialog.Description>
        <Dialog.Root>
          <Dialog.Activator data-bench="dialog-2-trigger">Open dialog 2</Dialog.Activator>
          <Dialog.Content data-bench="dialog-2">
            <Dialog.Title>Dialog 2</Dialog.Title>
            <Dialog.Description>Description 2</Dialog.Description>
            <button type="button" data-bench="dialog-2-action">Dialog 2 action</button>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Root>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  </div>
</template>
