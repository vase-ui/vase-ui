<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <!-- Opens the dialog when clicked. -->
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>Dialog</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
