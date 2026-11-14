<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger>Trigger 1</Dialog.Trigger>
    <Dialog.Trigger>Trigger 2</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>Dialog</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
