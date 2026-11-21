<script setup lang="ts">
import { Dialog } from '@vuetify/v0';
</script>

<template>
  <Dialog.Root>
    <Dialog.Activator data-bench="trigger">Open</Dialog.Activator>
    <Dialog.Content data-bench="popup">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Root>
</template>
