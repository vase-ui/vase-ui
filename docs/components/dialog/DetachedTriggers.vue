<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

const demoDialog = Dialog.createHandle();
</script>

<template>
  <Dialog.Trigger :handle="demoDialog">Open</Dialog.Trigger>

  <Dialog.Root :handle="demoDialog">
    <Dialog.Portal>
      <Dialog.Popup>Dialog</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
