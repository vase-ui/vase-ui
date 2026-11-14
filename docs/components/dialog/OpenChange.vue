<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

declare function doStuff(): void;

const open = shallowRef(false);

function handleOpenChange(nextOpen: boolean) {
  // Do stuff when the dialog is closed
  if (!nextOpen) {
    doStuff();
  }
  // Set the new state
  open.value = nextOpen;
}
</script>

<template>
  <Dialog.Root :open="open" @open-change="handleOpenChange">
    <!-- ... -->
  </Dialog.Root>
</template>
